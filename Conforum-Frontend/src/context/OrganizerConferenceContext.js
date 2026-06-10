import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "./Auth";

const OrganizerConferenceContext = createContext(null);

export const OrganizerConferenceProvider = ({ children }) => {
  const [auth] = useAuth();
  const userId = auth?.user?._id || auth?.user?.id;

  const [conferences, setConferences] = useState([]);
  const [selectedConference, setSelectedConference] = useState(() => {
    try {
      const saved = localStorage.getItem("organizer_selected_conference");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false); //  Track dropdown state

  //  Function to fetch conferences with smart comparison
  const fetchConferences = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get(`/api/auth/user-conferences/${userId}?role=organizer`);
      const rawList = res.data?.data?.conferences ?? [];
      const mappedList = rawList.map(conf => ({
        id: conf.conferenceId,
        conference_name: conf.conferenceName,
        acronym: conf.acronym || "",
        status: conf.status || ""
      }));

      //  Only update state if data actually changed (prevents unnecessary re-renders)
      setConferences(prevConferences => {
        const hasChanged = JSON.stringify(prevConferences) !== JSON.stringify(mappedList);
        return hasChanged ? mappedList : prevConferences;
      });

      // Auto-select first conference if none selected or saved selection no longer exists
      setSelectedConference(prev => {
        if (prev && mappedList.some(c => c.id === prev.id)) return prev;
        return mappedList[0] ?? null;
      });
    } catch (err) {
      console.error("Failed to fetch organizer conferences:", err);
      setConferences([]);
    } finally {
      setLoading(false);
    }
  };

  //  Initial fetch on mount or userId change
  useEffect(() => {
    fetchConferences();
  }, [userId]);

  //  POLLING: Refetch every 30 seconds (increased from 10 for smoother UX)
  // Skip refetch if dropdown is open to avoid stuttering
  useEffect(() => {
    if (!userId) return;

    console.log("[OrganizerConferenceProvider] Starting conference polling (30s interval)...");

    // Fetch immediately
    fetchConferences();

    // Then fetch every 30 seconds
    const pollInterval = setInterval(() => {
      //  Skip refetch if dropdown is open
      if (!isDropdownOpen) {
        console.log("[OrganizerConferenceProvider] Polling for conference updates...");
        fetchConferences();
      } else {
        console.log("[OrganizerConferenceProvider] Skipping poll - dropdown is open");
      }
    }, 600000); // 30 seconds (was 10)

    // Cleanup interval on unmount
    return () => {
      clearInterval(pollInterval);
      console.log("[OrganizerConferenceProvider] Polling stopped");
    };
  }, [userId, isDropdownOpen]); //  Add isDropdownOpen to dependencies

  const selectConference = (conf) => {
    setSelectedConference(conf);
    localStorage.setItem("organizer_selected_conference", JSON.stringify(conf));
  };

  return (
    <OrganizerConferenceContext.Provider
      value={{
        conferences,
        selectedConference,
        selectConference,
        conferenceId: selectedConference?.id ?? null,
        conferenceName: selectedConference?.conference_name ?? "",
        loading,
        refetchConferences: fetchConferences,
        isDropdownOpen, //  Export dropdown state
        setIsDropdownOpen, //  Export setter so components can update it
      }}
    >
      {children}
    </OrganizerConferenceContext.Provider>
  );
};

export const useOrganizerConference = () => useContext(OrganizerConferenceContext);
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Fetch organizer conferences for the current user.
  // Only updates state if the data actually changed to prevent unnecessary re-renders.
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

      setConferences(prevConferences => {
        const hasChanged = JSON.stringify(prevConferences) !== JSON.stringify(mappedList);
        return hasChanged ? mappedList : prevConferences;
      });

      // Keep the saved selection if it still exists in the new list,
      // otherwise fall back to the first conference.
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

  // Fetch on mount and whenever the logged-in user changes.
  useEffect(() => {
    fetchConferences();
  }, [userId]);

  // Poll every 10 minutes for conference updates.
  // Skips the refetch while the dropdown is open to avoid UI stuttering.
  useEffect(() => {
    if (!userId) return;

    fetchConferences();

    const pollInterval = setInterval(() => {
      if (!isDropdownOpen) {
        fetchConferences();
      }
    }, 600000);

    return () => clearInterval(pollInterval);
  }, [userId, isDropdownOpen]);

  // Persist the selected conference to localStorage so it survives page reloads.
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
        isDropdownOpen,
        setIsDropdownOpen,
      }}
    >
      {children}
    </OrganizerConferenceContext.Provider>
  );
};

export const useOrganizerConference = () => useContext(OrganizerConferenceContext);
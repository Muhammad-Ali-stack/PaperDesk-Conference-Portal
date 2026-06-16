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

  const fetchConferences = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get(`/api/auth/user-conferences/${userId}?role=organizer`);
      const rawList = res.data?.data?.conferences ?? [];
      const mappedList = rawList.map(item => ({
        id: item.conference?.id,
        conference_name: item.conference?.conference_name,
        acronym: item.conference?.acronym || "",
        status: item.conference?.status || ""
      }));

      setConferences(mappedList);

      // ── KEY FIX ──────────────────────────────────────────────
      // Always sync selectedConference with the fresh data from
      // the server. This ensures name/acronym updates are reflected
      // immediately after an edit without waiting for the next poll.
      setSelectedConference(prev => {
        if (!prev) return mappedList[0] ?? null;
        const freshVersion = mappedList.find(c => c.id === prev.id);
        if (freshVersion) {
          // Update localStorage with fresh data too
          localStorage.setItem("organizer_selected_conference", JSON.stringify(freshVersion));
          return freshVersion;
        }
        return mappedList[0] ?? null;
      });
    } catch (err) {
      console.error("Failed to fetch organizer conferences:", err);
      setConferences([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConferences();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const pollInterval = setInterval(() => {
      if (!isDropdownOpen) {
        fetchConferences();
      }
    }, 600000);
    return () => clearInterval(pollInterval);
  }, [userId, isDropdownOpen]);

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
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

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchConferences = async () => {
      setLoading(true);
      try {
        //  Correct endpoint – matches your backend
        const res = await axios.get(`/api/auth/user-conferences/${userId}?role=organizer`);
        //  Access the nested data.conferences array
        const rawList = res.data?.data?.conferences ?? [];
        //  Map backend fields to what the selector expects (id, conference_name)
        const mappedList = rawList.map(conf => ({
          id: conf.conferenceId,
          conference_name: conf.conferenceName,
          acronym: conf.acronym || "",
          status: conf.status || ""
        }));
        setConferences(mappedList);

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

    fetchConferences();
  }, [userId]);

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
      }}
    >
      {children}
    </OrganizerConferenceContext.Provider>
  );
};

export const useOrganizerConference = () => useContext(OrganizerConferenceContext);
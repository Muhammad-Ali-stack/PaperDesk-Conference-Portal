import React from "react";
import { useOrganizerConference } from "../context/OrganizerConferenceContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Loader2 } from "lucide-react";

const OrganizerConferenceSelector = () => {
  const { conferences, selectedConference, selectConference, loading } =
    useOrganizerConference();

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground text-xs">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading conferences…
      </div>
    );
  }

  if (conferences.length === 0) {
    return (
      <p className="text-xs text-muted-foreground px-3 py-2">
        No conferences found.
      </p>
    );
  }

  return (
    <Select
      value={selectedConference?.id ?? ""}
      onValueChange={(value) => {
        const conf = conferences.find((c) => c.id === value);
        if (conf) selectConference(conf);
      }}
    >
      <SelectTrigger className="w-full h-8 text-xs">
        <SelectValue placeholder="Select conference" />
      </SelectTrigger>
      <SelectContent>
        {conferences.map((conf) => (
          <SelectItem key={conf.id} value={conf.id} className="text-xs">
            {conf.conference_name}
            {conf.acronym ? ` (${conf.acronym})` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default OrganizerConferenceSelector;
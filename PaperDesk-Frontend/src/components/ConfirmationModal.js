import React from "react";
import { Button } from "./ui/button";
import { Trash2 } from "lucide-react";

const ConfirmationModal = ({ onConfirm, onCancel, title = "Confirm Action", description = "Are you sure you want to delete this? This action cannot be undone." }) => {
  return (
    <div className="flex flex-col items-center p-8 bg-card rounded-2xl shadow-2xl border max-w-sm mx-auto animate-fade-in">
      <div className="w-14 h-14 bg-destructive/10 rounded-full flex items-center justify-center mb-5">
        <Trash2 className="w-7 h-7 text-destructive" />
      </div>
      <h2 className="text-xl font-extrabold mb-2 text-foreground">{title}</h2>
      <p className="mb-7 text-center text-muted-foreground text-sm leading-relaxed">{description}</p>
      <div className="flex flex-col w-full gap-3">
        <Button variant="destructive" onClick={onConfirm} className="w-full">
          Yes, Delete
        </Button>
        <Button variant="outline" onClick={onCancel} className="w-full">
          Cancel
        </Button>
      </div>
    </div>
  );
};

export default ConfirmationModal;

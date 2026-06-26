import React from "react";
import { motion } from "framer-motion";
import { Warning, X } from "@phosphor-icons/react";

export default function ConfirmModal({ open, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", danger = false, onConfirm, onCancel, testid = "confirm-modal" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" data-testid={testid} onClick={onCancel}>
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass max-w-sm w-full p-6 rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${danger ? "bg-red-500/15 text-red-400 border border-red-500/30" : "bg-green-500/15 text-green-300 border border-green-500/30"}`}>
            <Warning size={20} weight="fill" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-bold">{title}</h3>
            <p className="text-sm text-zinc-400 mt-1">{message}</p>
          </div>
          <button data-testid={`${testid}-close`} onClick={onCancel} className="text-zinc-500 hover:text-white shrink-0"><X size={18} /></button>
        </div>
        <div className="flex gap-2 justify-end">
          <button data-testid={`${testid}-cancel`} onClick={onCancel} className="btn-ghost px-4 py-2 rounded-lg text-sm">{cancelLabel}</button>
          <button
            data-testid={`${testid}-confirm`}
            onClick={onConfirm}
            className={`${danger ? "btn-danger" : "btn-primary"} px-4 py-2 rounded-lg text-sm font-semibold`}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

"use client";

import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

type TextInputDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => Promise<void> | void;
  title: string;
  placeholder?: string;
  initialValue?: string;
  submitText?: string;
  isPending?: boolean;
};

export function TextInputDialog({
  isOpen,
  onClose,
  onSubmit,
  title,
  placeholder = "",
  initialValue = "",
  submitText = "保存",
  isPending = false,
}: TextInputDialogProps) {
  const [value, setValue] = useState(initialValue);

  // ダイアログが開くたびに初期値をリセット（編集時に前の値が入るようにする）
  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
    }
  }, [isOpen, initialValue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || isPending) return;
    await onSubmit(value.trim());
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* 背景オーバーレイ */}
      <div
        className="fixed inset-0 bg-black/60 transition-opacity"
        aria-hidden="true"
      />

      {/* ダイアログ中央配置 */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-xl border border-[#2E323B] bg-[#1C1F25] p-6 shadow-xl transition-all">
          <DialogTitle className="text-lg font-semibold text-[#E7E8EA]">
            {title}
          </DialogTitle>

          <form onSubmit={handleSubmit} className="mt-4">
            <input
              type="text"
              placeholder={placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full rounded-lg border border-[#2E323B] bg-[#15171B] px-3 py-2 text-sm text-[#E7E8EA] focus:border-[#3FB6A8] focus:outline-none"
              autoFocus
            />

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm text-[#98A0AC] hover:bg-[#2E323B]"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isPending || !value.trim()}
                className="flex items-center gap-2 rounded-lg bg-[#3FB6A8] px-4 py-2 text-sm font-medium text-slate-950 hover:bg-[#3FB6A8]/80 disabled:opacity-50"
              >
                {isPending && <Loader2 className="animate-spin" size={14} />}
                {submitText}
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

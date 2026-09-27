"use client";

import { useState, useTransition } from "react";
import { Plus, Loader2 } from "lucide-react";
import { createSubjectAction } from "../actions/newSubject"; // 後述の Server Action
import { TextInputDialog } from "./TextInputDialog";

export default function NewSubjectModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    startTransition(async () => {
      await createSubjectAction(title);
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="mb-8 flex w-full items-center justify-center gap-2 rounded-xl border border-[#3FB6A8]/40 bg-[#3FB6A8]/10 px-4 py-3 text-sm font-medium text-[#7ED6C9] transition-colors hover:bg-[#3FB6A8]/20"
      >
        <Plus size={16} />
        新しい学習をはじめる
      </button>

      {/* モーダルダイアログ */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#2E323B] bg-[#1C1F25] p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-[#E7E8EA]">
              新しい科目を追加
            </h2>
            <form onSubmit={handleSubmit} className="mt-4">
              <input
                type="text"
                placeholder="例: Web開発, 英語表現..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-[#2E323B] bg-[#15171B] px-3 py-2 text-sm text-[#E7E8EA] focus:border-[#3FB6A8] focus:outline-none"
                autoFocus
              />
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm text-[#98A0AC] hover:bg-[#2E323B]"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isPending || !title.trim()}
                  className="flex items-center gap-2 rounded-lg bg-[#3FB6A8] px-4 py-2 text-sm font-medium text-slate-950 hover:bg-[#3FB6A8]/80 disabled:opacity-50"
                >
                  {isPending && <Loader2 className="animate-spin" size={14} />}
                  作成する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <TextInputDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSubmit={async (value: string) => {
          if (!value.trim()) return;
          await createSubjectAction(value);
        }}
        title="新しい科目を追加"
        placeholder="例: Web開発, 英語表現..."
        submitText="作成する"
        isPending={isPending}
      />
    </>
  );
}

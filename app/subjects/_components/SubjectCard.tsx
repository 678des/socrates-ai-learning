"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { SubjectMenu } from "./SubjectMenu";
import { TextInputDialog } from "./TextInputDialog";
import { ConfirmDialog } from "./ConfirmDialog";

type Subject = {
  id: string;
  name: string;
  color?: string;
};

type SubjectCardProps = {
  subject: Subject;
  onRenameAction: (newName: string) => Promise<void>;
  onDeleteAction: () => Promise<void>;
};

export function SubjectCard({
  subject,
  onRenameAction,
  onDeleteAction,
}: SubjectCardProps) {
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false); // 削除ダイアログの状態
  const [isPending, startTransition] = useTransition();

  // 名前変更の実行
  const handleRenameSubmit = (newName: string) => {
    startTransition(async () => {
      await onRenameAction(newName);
      setIsRenameOpen(false);
    });
  };

  // 削除の実行
  const handleDeleteConfirm = () => {
    startTransition(async () => {
      await onDeleteAction();
      setIsDeleteOpen(false);
    });
  };

  return (
    <div
      className="rounded-xl border border-[#2E323B] bg-[#1C1F25] p-4 flex items-center justify-between"
      style={{ borderTopColor: subject.color || "#3FB6A8", borderTopWidth: 2 }}
    >
      <div className="flex items-center gap-2">
        <Link
          href={`/subjects/c/${subject.id}`}
          className="flex items-center gap-2"
        >
          <span className="text-sm font-medium text-[#E7E8EA]">
            {subject.name}
          </span>
        </Link>
      </div>

      {/* ドロップダウンメニュー */}
      <SubjectMenu
        onRename={() => setIsRenameOpen(true)}
        onDelete={() => setIsDeleteOpen(true)} // 削除ダイアログを開く
      />

      {/* 1. 名前変更ダイアログ */}
      <TextInputDialog
        isOpen={isRenameOpen}
        onClose={() => setIsRenameOpen(false)}
        onSubmit={handleRenameSubmit}
        title="科目を編集"
        initialValue={subject.name}
        submitText="変更を保存"
        isPending={isPending}
      />

      {/* 2. 削除確認ダイアログ（追加） */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="科目を削除"
        description={`「${subject.name}」を削除してもよろしいですか？この操作は取り消せません。`}
        confirmText="削除する"
        isPending={isPending}
      />
    </div>
  );
}

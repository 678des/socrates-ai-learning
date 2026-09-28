"use client";

import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import {
  EllipsisVerticalIcon,
  PencilIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

type SubjectMenuProps = {
  onRename?: () => void;
  onDelete?: () => void;
};

export function SubjectMenu({ onRename, onDelete }: SubjectMenuProps) {
  return (
    <Menu as="div" className="relative inline-block text-left">
      <MenuButton className="flex items-center rounded-lg p-1.5 text-[#98A0AC] hover:bg-[#2E323B] hover:text-[#E7E8EA] transition-colors">
        <EllipsisVerticalIcon className="h-5 w-5" />
      </MenuButton>

      {/* anchor="bottom end" を追加 */}
      <MenuItems
        anchor="bottom end"
        transition
        className="z-50 mt-1 w-40 rounded-xl border border-[#2E323B] bg-[#1C1F25] p-1 shadow-lg transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
      >
        <MenuItem>
          <button
            onClick={onRename}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-[#E7E8EA] hover:bg-[#2E323B] transition-colors"
          >
            <PencilIcon className="h-4 w-4 text-[#98A0AC]" />
            名前を変更
          </button>
        </MenuItem>

        <MenuItem>
          <button
            onClick={onDelete}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <TrashIcon className="h-4 w-4 text-red-400" />
            削除
          </button>
        </MenuItem>
      </MenuItems>
    </Menu>
  );
}

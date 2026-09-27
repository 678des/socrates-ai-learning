import { SubjectCard } from "./SubjectCard";
import {
  getSubjects,
  deleteSubject,
  updateSubjectName,
} from "@/lib/supabase/queries/subjects";
import { revalidatePath } from "next/cache";

export default async function SubjectTitleArea() {
  const subjects = await getSubjects();

  // 名前変更処理 (対象の id を引数で受ける)
  async function handleRename(id: string, newName: string) {
    "use server";

    if (!id) return;
    await updateSubjectName(id, newName);
    revalidatePath("/dashboard"); // パスはお使いのルーティングに合わせて変更してください
  }

  // 削除処理 (対象の id を引数で受ける)
  async function handleDelete(id: string) {
    "use server";

    if (!id) return;
    await deleteSubject(id);
    revalidatePath("/dashboard");
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {subjects.map((sub) => (
        <SubjectCard
          key={sub.id}
          subject={sub}
          // Bind などで個別の sub.id を渡すか、Card 側で sub.id を渡して呼び出す
          onRenameAction={handleRename.bind(null, sub.id)}
          onDeleteAction={handleDelete.bind(null, sub.id)}
        />
      ))}
    </div>
  );
}

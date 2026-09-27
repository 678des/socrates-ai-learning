import { createClient } from "@/lib/supabase/server"; // または環境に応じた Client 作成処理
import { Subject } from "@/lib/types";

import { revalidatePath } from "next/cache";

export async function getSubjects(): Promise<Subject[]> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("ユーザー情報の取得に失敗しました:", userError);
    return [];
  }
  const { data, error } = await supabase
    .from("subjects_new")
    .select("id, name, color")
    .is("deleted_at", null)
    .eq(`user_id`, user.id);
  // .order("created_at", { ascending: true });

  if (error) {
    console.error("カテゴリの取得に失敗しました:", error.message);
    return [];
  }
  console.log("取得したカテゴリ:", data, "ユーザー", user.id);
  return data as Subject[];
}
export async function getSubjectName(subjectId: string): Promise<string> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("ユーザー情報の取得に失敗しました:", userError);
    return "None";
  }
  const { data, error } = await supabase
    .from("subjects_new")
    .select("name")
    .is("deleted_at", null)
    .eq("user_id", user.id)
    .eq("id", subjectId)
    .maybeSingle();

  if (error) {
    console.error("カテゴリの取得に失敗しました:", error.message);
  }
  const subject = data as { name: string } | null;
  return subject?.name ?? "";
}

/**
 * 科目を論理削除する（deleted_at に現在時刻を設定）
 */
export async function deleteSubject(subjectId: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("認証されていません");
  }

  // 実際には削除せず、deleted_at にタイムスタンプを入れるだけ
  const { error } = await supabase
    .from("subjects_new")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", subjectId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Subject soft delete error:", error);
    throw new Error("科目の削除に失敗しました");
  }

  revalidatePath("/subjects");
}

/**
 * 科目名を変更する
 */
export async function updateSubjectName(subjectId: string, newName: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("認証されていません");
  }

  const { error } = await supabase
    .from("subjects_new")
    .update({ name: newName } as never)
    .eq("id", subjectId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Subject rename error:", error);
    throw new Error("名前の変更に失敗しました");
  }

  revalidatePath("/subjects");
}

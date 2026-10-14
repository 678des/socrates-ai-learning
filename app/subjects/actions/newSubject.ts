"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function createSubjectAction(subjectName: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error("認証エラー");

    // DB に新規作成
    const { data, error } = await supabase
      .from("subjects_new")
      .insert({
        user_id: user.id,
        name: subjectName, // 入力された科目名
        color: "blue",
      } as never)
      .select("id")
      .single();

    if (error || !data) {
      console.error(error?.message);
      throw new Error("科目の作成に失敗しました");
    }
  } catch (error) {
  } finally {
    redirect(`/subjects`);
  }
}

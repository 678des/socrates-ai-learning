"use server";

import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
export async function Exam(
  userAnswer: string,
  subjectId: string,
  probremId: string,
) {
  console.log("返答評価", userAnswer, probremId);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("認証されていないユーザーです");
  }

  console.log("subid", subjectId, "せす");
  const { data: room } = await supabase
    .from("chat_rooms_new")
    .select("id")
    .eq("subject_id", subjectId)
    .eq("user_id", user.id)
    .filter("mode", "eq", "review")
    .single();
  //現在のルームを取得
  const room_id = (room as { id: string } | null)?.id || "";
  //const room_id = "8b7a5e8a-54a7-49b5-87da-7b5af850d8cf";
  console.log("roomid", room_id);

  const { data: exam_problem } = await supabase
    .from("exam_problems")
    .select("question_content")
    .eq("id", probremId)
    .eq("room_id", room_id);

  const { data: exam_attempt } = await supabase
    .from("exam_attempts")
    .select("role, content")
    .eq("problem_id", probremId)
    .order("created_at", { ascending: true })
    .limit(50);

  const problem = (
    exam_problem as Array<{ question_content: string }> | null
  )?.[0]?.question_content;
  const allAns = (exam_attempt as Array<{ content: string }> | null)
    ?.map((attempt) => attempt.content)
    .join("\n");

  console.log("問題文", problem);
  const examSystemInstruction = `
あなたは一流のシニアエンジニア（技術面接官 / コードレビューアー）です。
これまでの問題とユーザーの回答を踏まえ、受講者が実務で通用する「本質的な理解力・応用力」に達しているかを判定・フィードバックしてください。

【問題文】
${problem}

【これまでのやり取り】
${allAns ? allAns : "（まだユーザーからの回答はありません。）"}

【役割と進行ルール】

1. **明確でテンポの良い評価**
   ユーザーから回答が届いたら、以下の3要素をコンパクトにまとめて返答してください。
   - **判定（冒頭）**: 【合格】/【惜しい（部分点）】/【再考が必要】のいずれかを明示
   - **フィードバック**: 正しい点と、実務視点で不足している視点・トレードオフの解説
   - **次のアクション**: 合格時は完了宣言、不合格時は「思考を修正するための小さなヒントや問いかけ」

2. **合格判定（クリア宣言）**
   以下の条件を満たしている場合のみ、メッセージ内で「**合格**」と伝え、セッションクリアを宣言してください。
   ＜合格条件＞
   - 核心となる原理やトレードオフを正しく捉えている
   - 致命的な誤解がなく、実務で危険なコード・設計にならない理解ができている

3. **不不合格時の伴走アプローチ（詰まらせない）**
   - 答えをそのまま丸呑みさせるような解説は避けますが、**ユーザーが自力で気づけるレベルまで噛み砕いた「1ミリのヒント」や具体例**を必ず添えてください。
   - 詰まっている様子があれば、ヒント付きの選択肢や小さな実験（「もしここを〇〇に変えたらどうなる？」）を提示して、再思考を促してください。

【トーン＆マナー】
- 実務のコードレビューのように、建設的でリスペクトのあるフランクなトーン。
- 長文の講義は避け、要点を箇条書きなどを交えて簡潔に伝えてください。`.trim();

  const geminiContents = [
    {
      role: "user",
      parts: [{ text: userAnswer }],
    },
  ];

  console.log("Geminiに渡すもの", geminiContents);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash-lite",
    contents: geminiContents,
    config: {
      systemInstruction: examSystemInstruction,
      temperature: 0.7,
    },
  });

  console.log("AIの解説", response.text);

  const { error } = await supabase.from("exam_attempts").insert({
    problem_id: probremId,
    content: userAnswer,
    role: "user",
  } as never);
  console.log("インサート", error);

  await supabase.from("exam_attempts").insert({
    problem_id: probremId,
    content: response.text,
    role: "assistant",
  } as never);

  return {
    success: true,
    aiResponceObj: {
      id: crypto.randomUUID(),
      role: "assistant",
      content: response.text || "",
      created_at: "",
    },
  };
}

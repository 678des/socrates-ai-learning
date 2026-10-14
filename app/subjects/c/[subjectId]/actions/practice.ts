"use server";

import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";

export async function PracticeExam(subjectId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("認証されていないユーザーです");
  }

  const { data: subject } = await supabase
    .from("subjects_new")
    .select("name")
    .eq("id", subjectId)
    .single();

  const { data: room } = await supabase
    .from("chat_rooms_new")
    .select("id")
    .eq("subject_id", subjectId)
    .eq("user_id", user.id)
    .filter("mode", "eq", "study")
    .single();
  const { data: ReviewRoom } = await supabase
    .from("chat_rooms_new")
    .select("id")
    .eq("subject_id", subjectId)
    .eq("user_id", user.id)
    .filter("mode", "eq", "review")
    .single();
  const { data: study_note } = await supabase
    .from("study_notes_new")
    .select("ai_summary,study_memo")
    .eq("subject_id", subjectId)
    .single();

  //科目名を取得
  const subject_name = (subject as { name: string } | null)?.name || "";

  //現在のルームを取得
  const room_id = (room as { id: string } | null)?.id || "";
  const reviewroom_id = (ReviewRoom as { id: string } | null)?.id || "";
  //現在の要約を取得
  const ai_summary =
    (study_note as { ai_summary: string } | null)?.ai_summary || "";
  //学習メモを取得
  const studyMemo =
    (study_note as { study_memo: string | null } | null)?.study_memo || "";

  const { data: exam_problems } = await supabase
    .from("exam_problems")
    .select("question_content")
    .eq("room_id", reviewroom_id);
  const existProblems = (exam_problems as { question_content: string }[] | null)
    ?.map((problem) => problem.question_content)
    .join("\n");

  const { data: recentMessages } = await supabase
    .from("messages_new")
    .select("role, content")
    .eq("room_id", room_id)
    .order("created_at", { ascending: false })
    .limit(10);

  const examSystemInstruction =
    `あなたは実務レベルの思考力を測定する「問題作成プロフェッショナルBOT」です。
単なる用語の暗記や選択問題ではなく、現場で直面するような「トラブルシューティング」「コードレビュー」「設計のトレードオフ」を問う実践的な問題を【1問だけ】出題してください。

【現在の学習コンテキスト】
・科目名/ノートタイトル: "${subject_name}"
・これまでの学習要約:
${ai_summary ? ai_summary : "（まだ要約はありません。）"}

【ユーザーの学習メモ（出題の最優先ソース）】
${studyMemo ? studyMemo : "（メモはありません。）"}

【作成済みの問題（重複厳禁）】
${existProblems ? existProblems : "（まだ作成済みの問題はありません。）"}

【問題作成ルール】
1. **問題の形式（1問ずつ出題）**
   - 「具体的な状況設定（または不具合のあるコード）」＋「本質を問う問い」のセットで出題してください。
   - 選択肢（A/B/C/D）は作らず、ユーザーに自分の言葉やロジックで答えさせる記述形式にしてください。

2. **重複の回避と切り口の変更**
   - 【作成済みの問題】とテーマ・問う角度が被らないようにしてください。
   - 例：1問目が「パフォーマンス（処理速度）」なら、2問目は「保守性・拡張性」「セキュリティ」「例外処理」など切り口を変えてください。

3. **学習メモの反映**
   - 【ユーザーの学習メモ】が存在する場合は、そこに書かれている概念や技術要素を優先的に組み込んだ問題にしてください。

4. **余計な挨拶や解説は出力しない**
   - 「問題を作成しました」「前回の復習です」などの前置きは一切不要です。いきなり問題文から出力してください。`.trim();

  const geminiContents = [
    // ② 過去ログ
    ...((recentMessages ?? []) as Array<{ role: string; content: string }>)
      .reverse()
      .map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      })),

    // ③ 今回のユーザー入力
    {
      role: "user",
      parts: [{ text: "ここまでの流れを踏まえて問題生成をしてください" }],
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

  await supabase.from("exam_problems").insert({
    room_id: reviewroom_id,
    question_content: response.text || "",
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

export type SendExamMessageResult = {
  success: true;
  aiResponceObj: {
    id: string;
    role: string;
    content: string;
    created_at: string;
  };
};

// export async function SendExamMessage(
//   subjectId: string,
//   userMessage: string,
// ): Promise<SendExamMessageResult | undefined> {
//   if (!userMessage.trim() || !subjectId.trim()) return;

//   const supabase = await createClient();

//   const {
//     data: { user },
//   } = await supabase.auth.getUser();

//   if (!user) {
//     throw new Error("認証されていないユーザーです");
//   }

//   // 1. 科目名を取得
//   const { data: subject } = await supabase
//     .from("subjects_new")
//     .select("name")
//     .eq("id", subjectId)
//     .single();

//   // 2. 「試験ルーム (mode: "exam")」のIDを取得
//   const { data: room } = await supabase
//     .from("chat_rooms_new")
//     .select("id")
//     .eq("subject_id", subjectId)
//     .eq("user_id", user.id)
//     .filter("mode", "eq", "review")
//     .single();

//   // 3. 学習ノートの要約を取得（試験の背景知識として活用）
//   const { data: study_note } = await supabase
//     .from("study_notes")
//     .select("ai_summary")
//     .eq("subject_id", subjectId)
//     .single();

//   const subject_name = (subject as { name: string } | null)?.name || "";
//   const room_id = (room as { id: string } | null)?.id || "";
//   const ai_summary =
//     (study_note as { ai_summary: string } | null)?.ai_summary || "";

//   // 4. 試験ルーム内での直近のメッセージ履歴を取得（問題と過去のやり取りの文脈用）
//   const { data: recentMessages } = await supabase
//     .from("messages_new")
//     .select("role, content")
//     .eq("room_id", room_id)
//     .order("created_at", { ascending: false })
//     .limit(10);

//   // 5. 試験官用のシステム指示（これまでと同じプロンプトを共通利用できます）
//   const examSystemInstruction = `
// あなたは一流のプロフェッショナルな試験官、かつ受講者の成長を心から願うシニアエンジニアです。
// これまでの学習内容（要約や対話履歴）を踏まえ、受講者が実務やプロの現場で通用する「本質的な理解力・応用力」に到達しているかを厳しく、しかし温かく判定してください。

// 【現在の学習コンテキスト】
// ・科目名/ノートタイトル: "${subject_name}"
// ・これまでの学習の要約とコンテクスト:
//     ${ai_summary ? ai_summary : "（まだ要約はありません。）"}

// 【あなたの役割と進行ルール】
// 1. 本格的な演習問題の出題（フェーズ1）
// - まだ問題を出題していない状態（または新しい問題に進む場合）は、これまでの学習コンテキストに基づき、丸暗記では通用しない「ケーススタディ」「設計課題」「原理原則を問う思考問題」を**1問ずつ**出題してください。
// - ユーザーに考えさせるため、問題文は具体的かつ実践的に提示してください。

// 2. 厳密な採点と本質的フィードバック（フェーズ2）
// - ユーザーから回答が提出されたら、単なる正解・不正解の判定だけでなく、以下を盛り込んでフィードバックを行ってください。
//   - **評価**: 正解か、部分点か、再考が必要か
//   - **原理原則の解説**: なぜその答えになるのか（背景にある構造、トレードオフ、根本原理）
//   - **改善点・不足している視点**: 実務の現場視点で足りていないポイントの指摘

// 3. 合格判定とセッションの終了
// - ユーザーの回答や対話を通じて、以下の合格条件を完全に満たしていると判断した場合のみ、フィードバックの最後に「合格」である旨を伝え、本セッションがクリアしたことを宣言してください。
//   - **合格条件**:
//     - 核心を論理的かつ正しく説明できている
//     - 誤解や致命的な勘違いがない
//     - 原理・理由・構造の本質を理解している
// - 合格に達していない場合は、追加の思考を促す問いかけやヒントを与え、納得がいくまで対話（再考）を続けてください。なお、合格に達していなくても、別の問題を新たに作ることだけは可能とします

// 【トーン＆マナー】
// - 厳しくも温かく受講者を導くプロの試験官・シニアエンジニアとしての口調（です・ます調、または的確で知的なトーン）を維持してください。
// - 安易に答えを教えず、受講者自身に気付かせる姿勢を崩さないでください。
// `.trim();

//   // 6. Geminiに渡すコンテンツの組み立て（試験ルームの過去ログ ＋ 今回のユーザーの回答）
//   const geminiContents = [
//     ...((recentMessages ?? []) as Array<{ role: string; content: string }>)
//       .reverse()
//       .map((msg) => ({
//         role: msg.role === "user" ? "user" : "model",
//         parts: [{ text: msg.content }],
//       })),
//     {
//       role: "user",
//       parts: [{ text: userMessage }],
//     },
//   ];

//   const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

//   const response = await ai.models.generateContent({
//     model: "gemini-3.5-flash-lite",
//     contents: geminiContents,
//     config: {
//       systemInstruction: examSystemInstruction,
//       temperature: 0.7,
//     },
//   });

//   // 7. ユーザーの回答を試験ルームのDBに保存
//   await supabase.from("messages_new").insert({
//     room_id: room_id,
//     role: "user",
//     content: userMessage,
//   } as never);

//   // 8. AIの採点・フィードバックを試験ルームのDBに保存
//   await supabase.from("messages_new").insert({
//     room_id: room_id,
//     role: "assistant",
//     content: response.text || "",
//   } as never);

//   return {
//     success: true,
//     aiResponceObj: {
//       id: crypto.randomUUID(),
//       role: "assistant",
//       content: response.text || "",
//       created_at: "",
//     },
//   };
// }

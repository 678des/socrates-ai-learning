"use server";

import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { after } from "next/server";

export type SendMessageResult = {
  success: true;
  aiResponceObj: {
    id: string;
    role: string;
    content: string;
    created_at: string;
  };
  buttons: boolean;
};

export async function SendMessage(
  subjectId: string,
  userMessage: string,
  mode: string,
): Promise<SendMessageResult | undefined> {
  if (
    !userMessage.trim() ||
    !subjectId.trim() ||
    !(mode == "review" || mode == "study")
  )
    return;
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
    .filter("mode", "eq", mode)
    .single();

  const { data: study_note } = await supabase
    .from("study_notes")
    .select("ai_summary")
    .eq("subject_id", subjectId)
    .single();

  //科目名を取得
  const subject_name = (subject as { name: string } | null)?.name || "";

  //現在のルームを取得
  const room_id = (room as { id: string } | null)?.id || "";

  //現在の要約を取得
  const ai_summary =
    (study_note as { ai_summary: string } | null)?.ai_summary || "";

  const { data: recentMessages } = await supabase
    .from("messages_new")
    .select("role, content")
    .eq("room_id", room_id)
    .order("created_at", { ascending: false })
    .limit(10);

  const instruction =
    `あなたは現場で一緒にコードを書く「経験豊富な先輩エンジニア（ペアプロ相手・コードレビューアー）」です。
単なる教科書的な知識の確認や暗記テストではなく、実務で通用する「本質的な理解」「応用力」「デバッグ思考」を育てることを目的として対話してください。

【現在の学習コンテキスト】
・科目名/ノートタイトル: "${subject_name}"
※タイトルが「無題」や抽象的な場合は、ユーザーの質問内容（本文）の文脈を最優先してください。

【過去のセッション要約】
${ai_summary ? ai_summary : "（まだ要約はありません。最初のセッションです）"}

【基本ループ：実務寄りペアプロ指導法】
1. **理論1ミリ ➔ 実務の手本（教えるフェーズ）**
   - ユーザーが未学習の場合やコードを求めたら、長文解説は避け、**実務で使える最小限のコード例や構成パターン（1ミリ）をサッと提示**してください。

2. **実務的トラブル・問いかけの提示（実践フェーズ）**
   - コードや概念を示した直後に、実務でよくあるシチュエーションを投げかけてください。
   - 例：「この実装、チーム開発で規模が大きくなった時にどんなバグが起きそう？」「実務でデータ量が10倍になったらどこがボトルネックになる？」「別のアプローチ（〇〇）と比べて、あえてこれを選ぶメリット・デメリット（トレードオフ）は何だと思う？」

3. **「コードを壊す・直す」デバッグ思考の提示**
   - 時には「あえて一部に不具合（潜在的バグ）が含まれたコード」を見せ、「これ期待通りに動かないんだけど、原因どこだと思う？」と問いかけてみてください。

4. **柔軟で本質主義なフィードバック**
   - 文言や定義の正確さ（教科書の丸暗記）にこだわらないでください。**言葉が多少違っても「実務での仕組みやロジック」を捉えていれば大正解**として褒めてください。
   - 答えに詰まったら、即座にヒントや正解を出し、学習をストップさせないこと。

【トーン＆マナー】
- 頼れるフランクな先輩エンジニアの口調（「ナイス！」「実務だとここハマりやすいんだよね」「これどう思う？」など）。
- 詰問するのではなく、一緒にコードを覗き込みながら会話するテンポ感を意識してください。

【模擬試験への移行判定】
ユーザーが以下の条件を満たした場合のみ、メッセージの最後に「**模擬問題に移りますか？**」と提案してください。
（※面接モードへの移行はUI側で行うため、提案のテキストを出力するだけで構いません）

＜移行基準＞
- 実務でのトレードオフや「なぜその実装にするのか」の理由を自分の言葉で説明できている
- 提示されたコードのバグや修正ポイントのロジックを正しく指摘できている`.trim();
  //現在のユーザーの書いているキーワードは、以下の項目です。{study_noteの変数「アーキテクチャ、○○の原則、○○定理、セキュリティ」}
  //必要に応じてこれらの項目とユーザーの発言から、現在何をユーザーに教えるべきかを判断してください。

  // const userMsgObj: Message = {
  //   id: crypto.randomUUID(),
  //   role: "user",
  //   content: userMessage,
  // };

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
      parts: [{ text: userMessage }],
    },
  ];

  console.log("Geminiに渡すもの", geminiContents);

  let ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash-lite",
    contents: geminiContents,
    config: {
      systemInstruction: instruction,
      temperature: 0.7,
    },
  });
  await supabase.from("messages_new").insert({
    room_id: room_id,
    role: "user",
    content: userMessage,
  } as never);

  console.log(room_id);

  // const { data: roomCheck } = await supabase
  //   .from("chat_rooms_new")
  //   .select("id, user_id, subject_id, mode")
  //   .eq("id", room_id)
  //   .single();

  // console.log("roomCheck:", roomCheck);
  // console.log("挿入成功", data);
  // console.log("挿入error", error);
  // console.log("room_id", room_id, "subjectId", subjectId);

  await supabase.from("messages_new").insert({
    room_id: room_id,
    role: "assistant",
    content: response.text || "",
  } as never);

  //console.log("trueか？", response.text?.includes("問題"));

  //会話がAIで終わるのを防ぐため

  after(async () => {
    console.log("dosummary");
    const summarySystemInstruction =
      `あなたは優秀な学習ドキュメントの要約AIです。これまでの対話ログから、ユーザーが獲得した知識や本質的な理解を、後から見返しやすいように構造化してまとめてください。`.trim();
    const recentLogText = (
      (recentMessages ?? []) as Array<{ role: string; content: string }>
    )
      .reverse()
      .map(
        (msg) => `${msg.role === "user" ? "ユーザー" : "AI"}: ${msg.content}`,
      )
      .join("\n");
    const beforeSummary = `
【前回の要約】
${ai_summary}

【直近の対話の流れ（過去ログ含む）】
${recentLogText}
ユーザー: ${userMessage}
AI: ${response.text}

上記を踏まえ、これまでの学習内容全体が網羅された最新の要約を、以下の形式で作成してください。
- **学習の到達点**: 
- **重要概念・本質**: 
- **残された課題・次のステップ**
  `.trim();

    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const newsummary = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: {
        role: "user",
        parts: [
          {
            text: beforeSummary,
          },
        ],
      },
      config: {
        systemInstruction: summarySystemInstruction,
        temperature: 0.2,
      },
    });
    const { error: summaryError } = await supabase
      .from("study_notes_new")
      .update({
        ai_summary: newsummary.text,
      } as never)
      .eq("subject_id", subjectId)
      .single();
    console.error("サマリーエラー", summaryError);

    console.log("AIの生成した要約", newsummary.text);
  });
  return {
    success: true,
    aiResponceObj: {
      id: crypto.randomUUID(),
      role: "assistant",
      content: response.text || "",
      created_at: "",
    },
    buttons: response.text?.includes("か") || false,
  };
}

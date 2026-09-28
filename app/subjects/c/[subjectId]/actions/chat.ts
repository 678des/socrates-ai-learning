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
    `あなたは妥協を許さない超厳格なプロフェッショナル・ラーニング・コーチです。
ユーザーは「自分は理解している」と思い込んでいるものの、実際は表面的な用語暗記や浅い知識にとどまっている（本質を全く理解していない）という前提に立って接してください。

【現在の学習コンテキスト】
・科目名/ノートタイトル: "${subject_name}"
※タイトルが「無題」や抽象的な場合は、ユーザーの質問内容（本文）の文脈を最優先してください。

【過去のセッション要約】
${ai_summary ? ai_summary : "（まだ要約はありません。最初のセッションです）"}

【指導方針・態度のルール】
1. **厳しい理解度判定（甘やかし厳禁）**
   - ユーザーの曖昧な返答、専門用語の受け売り、雰囲気だけの説明を絶対にスルーしないでください。
   - 「それはどういう意味ですか？」「なぜそう言えるのですか？」「別のケースでもそれが成り立ちますか？」と、本質的な原理を説明できるまで厳しく追及してください。
2. **「答え」や「コード」は簡単に教えない**
   - ユーザーが質問してきてもすぐに答えを渡さず、「まずどこまで理解できているか」「どこで思考が止まっているか」を問い詰めてください。
   - コードを求めてきた場合も、まずはロジックや概念の理解を問い、完全に理解したと確信できるまでコードの提示を拒否してください。
3. **1ミリの理論 ➔ 厳しい実践課題**
   - 説明は最小限（本質の核となる原理のみ）にとどめ、すぐに「では、〇〇という条件下でどうなるか説明（またはコード記述）してください」と、誤解が浮き彫りになる実践的な課題・問いを投げかけてください。

【対話のトーン】
- 丁寧語ではありますが、冷徹かつ厳格なスタンスを維持してください。
- ユーザーの「分かったつもり」に対しては、「それは表面的な理解に過ぎません」「論理に飛躍があります」と容赦なく指摘してください。

【模擬試験への移行判定】
ユーザーが以下の【極めて厳しい基準】をすべてクリアした場合のみ、メッセージの最後に「**模擬問題に移りますか？**」と提案してください。
（※面接モードへの移行はUI側で行うため、提案のテキストを出力するだけで構いません）

＜移行基準＞
- 単なる用語解説ではなく、「なぜそうなるのか（根本原理・トレードオフ・構造）」を自らの言葉で漏れなく論理的に説明できている
- AIからの意地悪なツッコミや反論（コーナーケースや例外）に対して、正しくロジックを返せている
- 「なんとなく」「たぶん」といった曖昧なニュアンスが一切排除されている`.trim();
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

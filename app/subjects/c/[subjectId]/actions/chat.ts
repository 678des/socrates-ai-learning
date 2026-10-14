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
    `あなたは一切の気休めや慰めを排除し、現実の事実と数値だけを突きつける鏡面AIです。
    ただし、ただ答えを押し付けるのではなく、ユーザーが「目の前の退屈な講義の基礎理論」と「自分がやりたいプロダクト開発（AI・Webアプリ）」の**共通項に自ら気づき、点と点がつながる快感（ドーパミン）を得るための「対話的誘導」**を行います。

    【目的】
    ユーザーの「理想の将来像」と「いま目の前で受動的にこなしている講義・作業」の乖離を突きつけつつ、退屈な基礎知識が「自分の武器に変わる瞬間」を体験させ、能動的な学習者へと覚醒させます。

    【入力データ】
    ユーザーから以下が入力されます：
    1. 「今、目の前の講義で自分がやっている具体的な行動・態度」

    【将来の理想像】
    AIに代替できない市場価値を持ち、技術が高い、自由な働き方ができるフリーランスウェブエンジニア

    【出力フォーマット（初回入力時）】
    ユーザーが入力したら、以下の4項目を必ず出力してください：
    1. 【シンクロ率（数値）】: 理想と現状行動の合致度（0%〜100%）を数値化し、その理由を指摘。
    2. 【時間の浪費・未達の構造図解】: アスキーアート（AA）や図解で、理想の軌道からどれだけ自分が逸脱しているかを可視化。
    3. 【えげつない現実の指摘】: 「いま講義をただ消化している姿」が3年後のキャリアに与える直接的被害を3行で言語化。
    4. 【理想へ引き戻すための15秒の覚醒行動】: この講義中に「受動的な作業者」から「能動的な制作者」にシフトするための唯一のアクションを指示。

    【2ターン目以降の対話ルール（最重要）】
    - ユーザーが質問や疑問を投げたとき、**最初からすべての答えや解説を文字の壁として出力するな。**
    - ユーザーの現在の開発スタック（Next.js, Gemini API, TypeScriptなど）と目の前の講義内容（エントロピーや数学など）が「どう結びついているか」をユーザー自身に推論させるような**強力な逆質問・フックを投げろ。**
    - ユーザーが自力で気づきを得たり、点と点がつながったときは、冷徹なトーンを保ちつつも、その知的好奇心の爆発（ドーパミン）を逃さず次のエンジニアリングの深淵へ引きずり込め。
    `.trim();
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
      temperature: 2,
    },
  });
  await supabase.from("messages_new").insert({
    room_id: room_id,
    role: "user",
    content: userMessage,
  } as never);

  console.log(room_id);

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

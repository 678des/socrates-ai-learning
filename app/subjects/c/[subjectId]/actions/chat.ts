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

  const instruction = `
あなたはユーザーの理想（高価値なフルスタックエンジニア）と現実（受動的な学習）のギャップを鮮明に映し出し、自発的な覚醒を促す「対話型鏡面AI」です。

【基本ペルソナ】
- 一切の気休め・慰め・甘やかしを排除する。
- 冷徹で鋭い事実突きつけと、知的好奇心を刺激する情熱を両立させる。
- 答えを教える「教師」ではなく、ユーザー自身に答えを掘り当てさせる「毒舌なソクラテス」であれ。

【目的】
ユーザーを受動的思考（Level 1-2）から救い出し、目の前の基礎理論と自身の開発スタック（Next.js / TypeScript / Web・AI開発等）の抽象的な共通項に自ら気づかせ、思考レベルをメタ認知・戦略的思考（Level 5-7）へ引き上げる。

【ユーザーの前提プロフィール】
- 理想像：AIに代替できない市場価値を持ち、高い技術力で自由に働くウェブエンジニア
- 現状：講義や基礎作業において受動的になりがち

【思考の7段階（指導指標）】
AIは対話を通じて、ユーザーの思考段階を引き上げることを内部目標とする。
- Level 1: 反応（眠気、退屈、不満）
- Level 2: 気づき（単語の暗記、表面的な観察）
- Level 3: 論理（筋道を立てた整理）
- Level 4: 批判（前提の疑問視、構造の検証）
- Level 5: メタ認知（自分の思考の癖やバイアスの客観視）
- Level 6: システム（背後にある構造・抽象的概念の把握）
- Level 7: 戦略（理論を自身の開発・行動へ自在に応用）

【出力フォーマット・対話ルール】
返答は必ず以下のフォーマットに従うこと。

---
### 1. 現状の鏡像（事実と数値）
- **シンクロ率**: [0〜100]% （理由を1〜2文で鋭く指摘）
- **推測される思考レベル**: Level [1〜7]

### 2. 核心のツッコミ
ユーザーの入力に対する洞察。「なぜその状態に陥っているのか」の背景や甘さを、事実に基づき冷徹に突く（200文字程度）。

### 3. ソクラテス・フック（思考の揺さぶり）
- **長文での解説や答えの提示は【厳禁】**。
- ユーザーが学んでいる「目の前の基礎知識・キーワード」と「実際のWeb/AI開発（アーキテクチャ・メモリ・非同期処理・抽象化など）」の接点に気づかせるための**【逆質問・問いかけ】を1〜2つだけ**投げかけよ。
- ユーザーに「自分の頭で仮説を立てさせる」形で返答を終わらせること。
---

【絶対禁止事項】
- 丁寧すぎる解説や、1回の返答で答えを完結させる「文字の壁」を出力すること。
- ユーザーを褒めちぎる、または単に罵倒するだけの無生産な発言。
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
      temperature: 0.7,
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

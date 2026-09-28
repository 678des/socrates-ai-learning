CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');
CREATE TYPE chat_mode AS ENUM ('study', 'review', 'chat');


CREATE TABLE subjects_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    color TEXT DEFAULT 'blue',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.subjects_new 
ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;



CREATE TABLE chat_rooms_new(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES subjects_new(id) ON DELETE CASCADE,
    mode chat_mode NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE messages_new(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES chat_rooms_new(id) ON DELETE CASCADE,
    role message_role NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE study_notes_new(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES subjects_new(id) ON DELETE CASCADE,
    ai_summary TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE study_notes_new 
ADD COLUMN study_memo TEXT;


CREATE TABLE exam_problems(
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   room_id UUID NOT NULL REFERENCES chat_rooms_new(id) ON DELETE CASCADE,
   question_content TEXT NOT NULL,
   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE exam_attempts(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id UUID NOT NULL REFERENCES exam_problems(id) ON DELETE CASCADE,
  role TEXT,
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);



CREATE INDEX messages_room_id_created_at_idx
ON messages_new(room_id, created_at DESC);


CREATE OR REPLACE FUNCTION create_default_note_obj()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- chat_rooms_new を2つ自動生成
  INSERT INTO chat_rooms_new (subject_id, user_id, mode)
  VALUES (NEW.id, NEW.user_id, 'study');

  INSERT INTO chat_rooms_new (subject_id, user_id, mode)
  VALUES (NEW.id, NEW.user_id, 'review');

  -- study_notes_new も自動生成
  INSERT INTO study_notes_new (subject_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$;




CREATE TRIGGER subjects_create_chat_rooms_new
AFTER INSERT ON subjects_new
FOR EACH ROW
EXECUTE PROCEDURE create_default_note_obj();


-- 権限
-- subjects
CREATE POLICY "Users can read their own subjects"
ON subjects_new
FOR SELECT
TO authenticated
USING ( user_id = auth.uid() );

CREATE POLICY "Users can insert their own subjects"
ON subjects_new
FOR INSERT
TO authenticated
WITH CHECK ( user_id = auth.uid() );

CREATE POLICY "Users can update their own subjects"
ON subjects_new
FOR UPDATE
TO authenticated
USING ( user_id = auth.uid() )
WITH CHECK ( user_id = auth.uid() );

CREATE POLICY "Users can delete their own subjects"
ON subjects_new
FOR DELETE
TO authenticated
USING ( user_id = auth.uid() );

-- messages
CREATE POLICY "Users can read their own messages"
ON messages_new
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM chat_rooms_new
    WHERE chat_rooms_new.id = messages_new.room_id
      AND chat_rooms_new.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own messages"
ON messages_new
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM chat_rooms_new
    WHERE chat_rooms_new.id = messages_new.room_id
      AND chat_rooms_new.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own messages"
ON messages_new
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM chat_rooms_new
    WHERE chat_rooms_new.id = messages_new.room_id
      AND chat_rooms_new.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM chat_rooms_new
    WHERE chat_rooms_new.id = messages_new.room_id
      AND chat_rooms_new.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own messages"
ON messages_new
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM chat_rooms_new
    WHERE chat_rooms_new.id = messages_new.room_id
      AND chat_rooms_new.user_id = auth.uid()
  )
);

--rooms
CREATE POLICY "Insert chat rooms via trigger"
ON chat_rooms_new
FOR INSERT
TO authenticated
WITH CHECK (true);


CREATE POLICY "Users can insert their own chat rooms"
ON chat_rooms_new
FOR INSERT
TO authenticated
WITH CHECK ( user_id = auth.uid() );

CREATE POLICY "Users can update their own chat rooms"
ON chat_rooms_new
FOR UPDATE
TO authenticated
USING ( user_id = auth.uid() )
WITH CHECK ( user_id = auth.uid() );

CREATE POLICY "Users can delete their own chat rooms"
ON chat_rooms_new
FOR DELETE
TO authenticated
USING ( user_id = auth.uid() );

--study_notes
CREATE POLICY "Users can read their own study notes"
ON study_notes_new
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM subjects_new
    WHERE subjects_new.id = study_notes_new.subject_id
    AND subjects_new.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own study notes"
ON study_notes_new
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM subjects_new
    WHERE subjects_new.id = study_notes_new.subject_id
    AND subjects_new.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own study notes"
ON study_notes_new
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM subjects_new
    WHERE subjects_new.id = study_notes_new.subject_id
    AND subjects_new.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM subjects_new
    WHERE subjects_new.id = study_notes_new.subject_id
    AND subjects_new.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own study notes"
ON study_notes_new
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM subjects_new
    WHERE subjects_new.id = study_notes_new.subject_id
    AND subjects_new.user_id = auth.uid()
  )
);



-- ==========================================
-- exam_problems のポリシー
-- ==========================================

CREATE POLICY "Users can read their own exam problems"
ON exam_problems
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM chat_rooms_new
    WHERE chat_rooms_new.id = exam_problems.room_id
      AND chat_rooms_new.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own exam problems"
ON exam_problems
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM chat_rooms_new
    WHERE chat_rooms_new.id = exam_problems.room_id
      AND chat_rooms_new.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own exam problems"
ON exam_problems
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM chat_rooms_new
    WHERE chat_rooms_new.id = exam_problems.room_id
      AND chat_rooms_new.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM chat_rooms_new
    WHERE chat_rooms_new.id = exam_problems.room_id
      AND chat_rooms_new.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own exam problems"
ON exam_problems
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM chat_rooms_new
    WHERE chat_rooms_new.id = exam_problems.room_id
      AND chat_rooms_new.user_id = auth.uid()
  )
);


-- ==========================================
-- exam_attempts のポリシー
-- （親の exam_problems と chat_rooms を二段階でチェック）
-- ==========================================

CREATE POLICY "Users can read their own exam attempts"
ON exam_attempts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM exam_problems
    JOIN chat_rooms_new ON chat_rooms_new.id = exam_problems.room_id
    WHERE exam_problems.id = exam_attempts.problem_id
      AND chat_rooms_new.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own exam attempts"
ON exam_attempts
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM exam_problems
    JOIN chat_rooms_new ON chat_rooms_new.id = exam_problems.room_id
    WHERE exam_problems.id = exam_attempts.problem_id
      AND chat_rooms_new.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own exam attempts"
ON exam_attempts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM exam_problems
    JOIN chat_rooms_new ON chat_rooms_new.id = exam_problems.room_id
    WHERE exam_problems.id = exam_attempts.problem_id
      AND chat_rooms_new.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM exam_problems
    JOIN chat_rooms_new ON chat_rooms_new.id = exam_problems.room_id
    WHERE exam_problems.id = exam_attempts.problem_id
      AND chat_rooms_new.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own exam attempts"
ON exam_attempts
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM exam_problems
    JOIN chat_rooms_new ON chat_rooms_new.id = exam_problems.room_id
    WHERE exam_problems.id = exam_attempts.problem_id
      AND chat_rooms_new.user_id = auth.uid()
  )
);
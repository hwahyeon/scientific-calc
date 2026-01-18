import { ensureAnonAuth } from "../lib/firebase/anon";
import { db } from "../lib/firebase/client";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";

type UiLang = "ko" | "en";

const ADMIN_UID = import.meta.env.PUBLIC_ADMIN_UID;

const LABELS: Record<
  UiLang,
  {
    title: string;
    placeholder: string;
    submit: string;
    latest: string;
    answer: string;
    noAnswer: string;
    adminAnswerPlaceholder: string;
    saveAnswer: string;
    saving: string;
    saved: string;
    saveFailed: string;
  }
> = {
  ko: {
    title: "Q&A",
    placeholder: "질문을 적어주세요",
    submit: "제출",
    latest: "최신 질문",
    answer: "답변",
    noAnswer: "아직 답변이 없습니다.",
    adminAnswerPlaceholder: "답변을 입력하세요",
    saveAnswer: "답변 저장",
    saving: "저장 중...",
    saved: "저장됨",
    saveFailed: "저장 실패",
  },
  en: {
    title: "Q&A",
    placeholder: "Ask a question",
    submit: "Submit",
    latest: "Latest",
    answer: "Answer",
    noAnswer: "No answer yet.",
    adminAnswerPlaceholder: "Write an answer",
    saveAnswer: "Save answer",
    saving: "Saving...",
    saved: "Saved",
    saveFailed: "Save failed",
  },
};

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getUiLang(): UiLang {
  const root = document.getElementById("qna-root");
  const raw = root?.getAttribute("data-ui-lang") ?? "ko";
  return raw === "en" ? "en" : "ko";
}

async function main() {
  const root = document.getElementById("qna-root");
  if (!root) return;

  const uiLang = getUiLang();
  const t = LABELS[uiLang];

  root.innerHTML = `
    <div class="max-w-2xl">
      <h1 class="text-2xl font-semibold tracking-tight">${escapeHtml(t.title)}</h1>

      <form id="qna-form" class="mt-6 space-y-3">
        <textarea
          id="qna-text"
          class="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900"
          rows="4"
          placeholder="${escapeHtml(t.placeholder)}"
          required
        ></textarea>

        <button
          class="cursor-pointer rounded-md border border-neutral-200 px-3 py-2 text-sm transition hover:bg-neutral-100 hover:shadow-sm dark:border-neutral-800 dark:hover:bg-neutral-800/60"
          type="submit"
        >
          ${escapeHtml(t.submit)}
        </button>
      </form>

      <div class="mt-8">
        <h2 class="text-sm font-medium text-neutral-500 dark:text-neutral-400">
          ${escapeHtml(t.latest)}
        </h2>
        <ul id="qna-list" class="mt-3 space-y-2"></ul>
      </div>
    </div>
  `;

  const form = root.querySelector<HTMLFormElement>("#qna-form");
  const textarea = root.querySelector<HTMLTextAreaElement>("#qna-text");
  const list = root.querySelector<HTMLUListElement>("#qna-list");
  if (!form || !textarea || !list) return;

  const user = await ensureAnonAuth();
  const isAdmin = user.uid === ADMIN_UID;

  const q = query(collection(db, "questions"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snap) => {
    list.innerHTML = "";

    snap.forEach((snapDoc) => {
      const id = snapDoc.id;
      const d = snapDoc.data() as { text?: unknown; answer?: unknown };
      const text = (d.text ?? "").toString();
      const answer = d.answer ? d.answer.toString() : "";

      const li = document.createElement("li");
      li.className =
        "rounded-md border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900";

      li.innerHTML = `
        <div class="whitespace-pre-wrap">${escapeHtml(text)}</div>

        ${
          answer
            ? `<div class="mt-3 border-t border-neutral-200 pt-3 text-neutral-700 dark:border-neutral-800 dark:text-neutral-200">
                 <div class="text-xs font-medium text-neutral-500 dark:text-neutral-400">${escapeHtml(
                   t.answer,
                 )}</div>
                 <div class="mt-1 whitespace-pre-wrap">${escapeHtml(answer)}</div>
               </div>`
            : `<div class="mt-3 text-xs text-neutral-500 dark:text-neutral-400">${escapeHtml(
                t.noAnswer,
              )}</div>`
        }

        ${
          isAdmin
            ? `
              <div class="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
                <div class="text-xs font-medium text-neutral-500 dark:text-neutral-400">${escapeHtml(
                  t.answer,
                )} (Admin)</div>

                <textarea
                  data-answer-input="${escapeHtml(id)}"
                  class="mt-2 w-full rounded-md border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900"
                  rows="4"
                  placeholder="${escapeHtml(t.adminAnswerPlaceholder)}"
                >${escapeHtml(answer)}</textarea>

                <div class="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    data-save-answer="${escapeHtml(id)}"
                    class="cursor-pointer rounded-md border border-neutral-200 px-3 py-2 text-sm transition hover:bg-neutral-100 hover:shadow-sm dark:border-neutral-800 dark:hover:bg-neutral-800/60"
                  >
                    ${escapeHtml(t.saveAnswer)}
                  </button>
                  <span data-save-status="${escapeHtml(id)}" class="text-xs text-neutral-500 dark:text-neutral-400"></span>
                </div>
              </div>
            `
            : ""
        }
      `;

      list.appendChild(li);
    });

    if (isAdmin) {
      // attach handlers after rendering
      const buttons =
        list.querySelectorAll<HTMLButtonElement>("[data-save-answer]");
      buttons.forEach((btn) => {
        btn.onclick = async () => {
          const id = btn.getAttribute("data-save-answer");
          if (!id) return;

          const input = list.querySelector<HTMLTextAreaElement>(
            `[data-answer-input="${CSS.escape(id)}"]`,
          );
          const status = list.querySelector<HTMLSpanElement>(
            `[data-save-status="${CSS.escape(id)}"]`,
          );
          if (!input || !status) return;

          const newAnswer = input.value.trim();

          btn.disabled = true;
          status.textContent = t.saving;

          try {
            await updateDoc(doc(db, "questions", id), {
              answer: newAnswer.length ? newAnswer : null,
              answeredAt: newAnswer.length ? serverTimestamp() : null,
            });
            status.textContent = t.saved;
          } catch {
            status.textContent = t.saveFailed;
          } finally {
            btn.disabled = false;
            setTimeout(() => {
              status.textContent = "";
            }, 1500);
          }
        };
      });
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = textarea.value.trim();
    if (!text) return;

    await addDoc(collection(db, "questions"), {
      text,
      createdAt: serverTimestamp(),
      answer: null,
      answeredAt: null,
    });

    textarea.value = "";
  });
}

main();

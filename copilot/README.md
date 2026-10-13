# Агент «PPM ReportHelper» — помощник статус-отчёта

План — [docs/superpowers/plans/2026-10-12-copilot-report-assistant.md](../docs/superpowers/plans/2026-10-12-copilot-report-assistant.md) (итоги этапа 1 — там же).

## Где и какой

| Что | Значение |
|---|---|
| Окружение | «PPM Copilot» (Sandbox, Europe), ID `080c2e69-dd53-e56d-b5aa-febee943ab4b` |
| Агент | **классический** (стандартная среда выполнения): «Інші способи створення». Агенты нового типа (GitHub Copilot harness) SDK агентов не поддерживает |
| Схемное имя | `crb3f_PPMReportHelper` — `spfx/src/webparts/pmoPortal/ai/aiConfig.ts` |
| Создатель | нужна «Microsoft Copilot Studio User License»; пилотным PM — не нужна |
| Доступ | «Поділитися» → группа «PPM Copilot» (группа безопасности окружения), «Доступ користувача»; остальным — `AccessToBotDenied` |
| Вход | «Автентифікація за допомогою Microsoft»; портал — SPA «PPM Copilot Client» + MSAL |
| Оркестрация | классическая; знаний, веб-поиска, общих знаний, коннекторов и потоков нет |
| Темы | специальные (Greeting, Goodbye, Start Over, Thank you), Escalate, Conversational boosting — выключены; остальные системные — включены |

## Как устроен вызов

Портал отправляет одно сообщение (`logic/aiEval.ts`, `aiMessage`):

```
ЧЕРНЕТКА | ПЕРЕВІРКА
<<DATA>>
{контекст проекта — logic/aiContext.ts, buildReportContext}
<</DATA>>
```

Тема Fallback ([topic-fallback.yaml](topic-fallback.yaml)) сохраняет текст в `Topic.Msg`, по первому слову вызывает prompt и отправляет его текст ответом:

| Первое слово | Prompt | Ответ (разбор — `logic/aiReply.ts`) |
|---|---|---|
| `ЧЕРНЕТКА` | [«Чернетка звіту»](prompts/draft.md) | `{"done","next","issues","summary","remember":[…],"ratings":{…}}` — `parseDraft` |
| `ПЕРЕВІРКА` | [«Перевірка звіту»](prompts/check.md) | `{"items":[…]}` — `parseCheck` |
| остальное (`ТЕСТ:`) | «Перевірка ТЕСТ» (страница проверки) | `{"ok","len","first"}` |

**Согласие.** При первом вызове prompt Copilot Studio присылает вместо ответа карточку `aiPrompt/consentCard` (Allow / Cancel) — один раз на пользователя. Портал показывает её как «Дозволити» и отправляет значение кнопки (`AiConversation.sendValue`); тема продолжается с сохранённым `Topic.Msg`.

## Набор проверок

`spfx/src/webparts/pmoPortal/ai/evalCases.json` — 15 случаев «Чернетки», 15 «Перевірки», 4 негативных (подмена инструкций, просьба показать инструкции). Ожидания и подсчёт — `logic/aiEval.ts` (тесты — `spfx/test/aiEval.test.ts`). Запуск — страница проверки (`#…///ai-spike`, пилот) → «Набір перевірок» → «Копіювати результат». Порог — **14 из 15** на каждый prompt и **все** негативные. После любого изменения prompt или модели — прогнать заново и записать итог в план.

## Как обновить агента

1. Prompt: «Інструменти» → prompt → текст из `prompts/*.md` (строку `[msg]` — входом `msg`) → «Зберегти».
2. Тема: Fallback → редактор кода → `topic-fallback.yaml` с ID prompt → в конце Enter + Backspace → «Закрити редактор коду» → «Зберегти».
3. «Опублікувати» (портал вызывает только опубликованную версию; тестовая панель — черновик).
4. «Набір перевірок» на странице проверки.

"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowUp, Compass, Info, LoaderCircle, RotateCcw } from "lucide-react";
import { usePlanner } from "./provider";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  Message,
  MessageContent,
  MessageHeader,
} from "@/components/ui/message";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from "@/components/ui/message-scroller";
import { Trace, TraceLine, TraceIcon, TraceTitle } from "@/components/ui/trace";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export function ChatPanel() {
  const { state, actions, meta } = usePlanner();
  const [draft, setDraft] = useState("");
  const [resetDone, setResetDone] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || state.busy) {
      textarea.current?.focus();
      return;
    }
    const message = draft;
    setDraft("");
    const sent = await actions.send(message);
    if (!sent) setDraft(message);
  }
  return (
    <section className="chat-panel" aria-labelledby="chat-title">
      <div className="chat-panel-heading">
        <div className="guide-symbol">
          <Compass aria-hidden="true" />
        </div>
        <div>
          <h2 id="chat-title">Tu compañero de viaje</h2>
          <p>
            {state.mode === "gemini"
              ? "Conversando con Gemini"
              : state.mode === "demo"
                ? "OpenStreetMap · planificación sin IA"
                : "Una conversación, tu próximo recorrido"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Iniciar un nuevo viaje"
          disabled={state.busy}
          onClick={() => {
            actions.reset();
            setResetDone(true);
          }}
        >
          <RotateCcw aria-hidden="true" />
        </Button>
      </div>
      {resetDone ? (
        <Alert>
          <AlertDescription>
            Empezaste un nuevo viaje.{" "}
            <button
              className="inline-link"
              onClick={() => {
                actions.restore();
                setResetDone(false);
              }}
            >
              Deshacer
            </button>
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="chat-thread">
        <MessageScrollerProvider autoScroll>
          <MessageScroller>
            <MessageScrollerViewport>
              <MessageScrollerContent
                className="p-5"
                role="log"
                aria-label="Conversación"
                aria-live="polite"
              >
                {state.messages.map((m, i) => (
                  <MessageScrollerItem
                    key={i}
                    messageId={String(i)}
                    scrollAnchor={m.role === "user"}
                  >
                    <Message align={m.role === "user" ? "end" : "start"}>
                      <MessageContent>
                        <MessageHeader>
                          {m.role === "user" ? "Tú" : "Guía Nariño"}
                        </MessageHeader>
                        <Bubble
                          variant={m.role === "user" ? "secondary" : "ghost"}
                          align={m.role === "user" ? "end" : "start"}
                        >
                          <BubbleContent>
                            <p className="message-text">{m.content}</p>
                          </BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                ))}
                {state.busy ? (
                  <MessageScrollerItem messageId="loading">
                    <Trace>
                      <TraceLine status="running">
                        <TraceIcon>
                          <LoaderCircle aria-hidden="true" />
                        </TraceIcon>
                        <TraceTitle>Preparando tu recorrido…</TraceTitle>
                      </TraceLine>
                    </Trace>
                  </MessageScrollerItem>
                ) : null}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton aria-label="Ir al último mensaje" />
          </MessageScroller>
        </MessageScrollerProvider>
      </div>
      {state.notice ? (
        <div className="chat-feedback">
          <Alert>
            <Info aria-hidden="true" />
            <AlertDescription>{state.notice}</AlertDescription>
          </Alert>
        </div>
      ) : null}
      {state.error ? (
        <div className="chat-feedback">
          <Alert variant="destructive">
            <AlertTitle>No se pudo completar la solicitud</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        </div>
      ) : null}
      <div className="chat-composer">
        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel className="sr-only" htmlFor="travel-message">
                Cuéntanos sobre tu viaje
              </FieldLabel>
              <InputGroup>
                <InputGroupTextarea
                  id="travel-message"
                  name="travel-message"
                  autoComplete="off"
                  ref={textarea}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Busca un lugar o cuéntame tu idea de viaje…"
                  maxLength={meta.maxMessageLength}
                  disabled={state.busy}
                  rows={3}
                />
                <InputGroupAddon align="block-end">
                  <span className="composer-hint">
                    {draft.length > 2200 ? `${draft.length}/2500` : null}
                  </span>
                  <Button
                    type="submit"
                    size="icon"
                    aria-label="Enviar mensaje"
                    disabled={state.busy}
                  >
                    {state.busy ? (
                      <LoaderCircle aria-hidden="true" />
                    ) : (
                      <ArrowUp aria-hidden="true" />
                    )}
                  </Button>
                </InputGroupAddon>
              </InputGroup>
            </Field>
          </FieldGroup>
        </form>
        {state.itinerary || state.results.length ? (
          <a className="mobile-plan-link" href="#mi-itinerario">
            Ver mapa e itinerario ↓
          </a>
        ) : null}
      </div>
    </section>
  );
}

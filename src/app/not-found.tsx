import { NotFoundRedirect } from "./NotFoundRedirect";

/**
 * A link to a level/chapter/lesson published after the last build has no
 * pre-rendered page: send it to the live route instead of a dead end.
 */
export default function NotFound() {
  return <NotFoundRedirect />;
}

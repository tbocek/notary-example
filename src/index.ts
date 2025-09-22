import { hydrate } from "svelte";
import 'fast-text-encoding'; //polyfill
import App from "./App.svelte";

hydrate(App, {
  target: document.getElementById("root")!,
  props: {},
});

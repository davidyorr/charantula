import { render } from "solid-js/web";

import "@/renderer/shared/global.css";

import { App } from "./App";

render(() => <App />, document.getElementById("root")!);

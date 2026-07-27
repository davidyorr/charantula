import { App } from "@/renderer/App";
import "@/renderer/shared/global.css";

import { render } from "solid-js/web";

render(() => <App />, document.getElementById("root")!);

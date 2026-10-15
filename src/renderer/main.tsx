import { render } from "solid-js/web";

import { App } from "@/renderer/App";
import "@/renderer/shared/global.css";

render(() => <App />, document.getElementById("root")!);

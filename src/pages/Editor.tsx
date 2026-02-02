import { clientOnly } from "@solidjs/start";

const RichTextEditor = clientOnly(
	() => import("../components/lexical/components/RichTextEditor.tsx"),
);

function Editor() {
	return (
		<div>
			<h1>Editor</h1>
			<RichTextEditor />
		</div>
	);
}

export default Editor;

import { useNavigate, useParams, useSearchParams } from "@solidjs/router";
import { createMemo } from "solid-js";

import { CharacterViewer } from "@/renderer/features/character-viewer/CharacterViewer";

type SearchParams = {
	back?: string;
};

export const CharacterViewerPage = () => {
	const params = useParams();
	const [searchParams] = useSearchParams<SearchParams>();
	const navigate = useNavigate();

	const characterId = createMemo(() => params.characterId as string);

	const handleBack = () => {
		const back = searchParams.back;
		if (back) {
			navigate(back);
		} else {
			navigate(`/timeline/${encodeURIComponent(params.projectName as string)}`);
		}
	};

	return <CharacterViewer characterId={characterId()} onBack={handleBack} />;
};

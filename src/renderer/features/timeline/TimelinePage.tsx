import { useNavigate, useParams, useSearchParams } from "@solidjs/router";
import { SquarePen } from "lucide-solid";
import type { Component } from "solid-js";

import { ChapterPicker } from "@/renderer/features/timeline/ChapterPicker";
import { CharacterPicker } from "@/renderer/features/timeline/CharacterPicker";
import { TimelineView } from "@/renderer/features/timeline/TimelineView";
import { NavigationButton } from "@/renderer/shared/NavigationButton";

import styles from "./TimelinePage.module.css";

type SearchParams = {
	chapter?: string;
	character?: string;
};

export const TimelinePage: Component = () => {
	const params = useParams();
	const [searchParams, setSearchParams] = useSearchParams<SearchParams>();
	const navigate = useNavigate();

	const selectedChapter = () => searchParams.chapter;
	const selectedCharacter = () => searchParams.character;

	const handleEditClick = () => {
		navigate(`/edit/${encodeURIComponent(params.projectName as string)}`);
	};

	const handleChapterSelect = (chapterId: string) => {
		setSearchParams({ chapter: chapterId, character: undefined });
	};

	const handleCharacterSelect = (characterId: string) => {
		setSearchParams({ character: characterId });
	};

	return (
		<div class={styles.page}>
			<NavigationButton
				icon={SquarePen}
				label="Edit"
				onClick={handleEditClick}
			/>

			<main class={styles.main}>
				{!selectedChapter() ? (
					<ChapterPicker onSelect={handleChapterSelect} />
				) : !selectedCharacter() ? (
					<CharacterPicker
						chapterId={selectedChapter()!}
						onSelect={handleCharacterSelect}
					/>
				) : (
					<TimelineView
						chapterId={selectedChapter()!}
						characterId={selectedCharacter()!}
					/>
				)}
			</main>
		</div>
	);
};

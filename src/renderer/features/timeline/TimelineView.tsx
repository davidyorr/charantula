import { ChevronLeft, ChevronRight } from "lucide-solid";
import {
	createMemo,
	createResource,
	createSignal,
	onMount,
	Show,
	type Component,
} from "solid-js";

import { IconButton } from "@/renderer/shared/IconButton";
import { project } from "@/renderer/shared/projectStore";

import styles from "./TimelineView.module.css";

type ImageResult = {
	path: string;
	url: string | null;
};

type Props = {
	chapterId: string;
	characterId: string;
};

export const TimelineView: Component<Props> = (props) => {
	const chapter = createMemo(() => project.chapters.get(props.chapterId));
	const collection = createMemo(() => {
		const collectionId = chapter()?.collectionId;
		return collectionId ? project.collections.get(collectionId) : undefined;
	});
	const character = createMemo(() => project.characters.get(props.characterId));

	// Fetch all event-character join rows for this character
	const [eventChars] = createResource(
		() => props.characterId,
		(characterId) => window.api.eventCharacters.listByCharacter(characterId),
	);

	// Build the ordered list of matching events from all collections
	// up to and including the selected collection, then all chapters
	// up to and including the selected chapter.
	const timelineEvents = createMemo(() => {
		const chars = eventChars();
		if (!chars) {
			return [];
		}

		const characterEventIds = new Set(chars.map((ec) => ec.eventId));
		const selectedCollection = collection();
		const selectedCollectionSortOrder = selectedCollection?.sortOrder ?? 0;
		const selectedChapterSortOrder = chapter()?.sortOrder ?? 0;

		const relevantEvents = project.events
			.list()
			.filter((ev) => {
				const evChapter = project.chapters.get(ev.chapterId);
				const evCollection = evChapter
					? project.collections.get(evChapter.collectionId)
					: undefined;
				const evCollectionSortOrder = evCollection?.sortOrder ?? 0;

				// Include events from earlier collections, or from the same
				// collection but earlier chapters.
				if (evCollectionSortOrder > selectedCollectionSortOrder) {
					return false;
				}
				if (
					evCollectionSortOrder === selectedCollectionSortOrder &&
					evChapter?.sortOrder !== undefined &&
					evChapter.sortOrder > selectedChapterSortOrder
				) {
					return false;
				}

				return characterEventIds.has(ev.id);
			})
			.sort((a, b) => {
				const chapterA = project.chapters.get(a.chapterId);
				const chapterB = project.chapters.get(b.chapterId);
				const collA = chapterA
					? project.collections.get(chapterA.collectionId)
					: undefined;
				const collB = chapterB
					? project.collections.get(chapterB.collectionId)
					: undefined;
				const collDiff = (collA?.sortOrder ?? 0) - (collB?.sortOrder ?? 0);
				if (collDiff !== 0) {
					return collDiff;
				}
				const chapterDiff =
					(chapterA?.sortOrder ?? 0) - (chapterB?.sortOrder ?? 0);
				if (chapterDiff !== 0) {
					return chapterDiff;
				}
				return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
			});

		return relevantEvents;
	});

	const [currentIndex, setCurrentIndex] = createSignal(0);

	const currentEvent = createMemo(() => {
		const events = timelineEvents();
		if (events.length === 0) {
			return null;
		}
		return events[currentIndex()];
	});

	// Determine the effective image path: event image, or chapter image as fallback.
	const effectiveImagePath = createMemo(() => {
		const ev = currentEvent();
		if (!ev) {
			return null;
		}
		return (
			ev.imagePath ?? project.chapters.get(ev.chapterId)?.imagePath ?? null
		);
	});

	const [imageResult] = createResource<ImageResult, string>(
		effectiveImagePath,
		async (imagePath) => ({
			path: imagePath,
			url: await window.api.images.getDataUrl(imagePath),
		}),
	);

	const currentImageUrl = createMemo(() => {
		const result = imageResult();

		if (result?.path === effectiveImagePath()) {
			return result.url;
		}

		return null;
	});

	const navigateTo = (index: number) => {
		const events = timelineEvents();
		if (index >= 0 && index < events.length) {
			setCurrentIndex(index);
		}
	};

	const handlePrevClick = () => {
		navigateTo(currentIndex() - 1);
	};

	const handleNextClick = () => {
		navigateTo(currentIndex() + 1);
	};

	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === "ArrowLeft") {
			navigateTo(currentIndex() - 1);
		} else if (e.key === "ArrowRight") {
			navigateTo(currentIndex() + 1);
		}
	};

	onMount(() => {
		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	});

	return (
		<div
			class={styles.container}
			style={{
				"background-image": currentImageUrl()
					? `url(${currentImageUrl()})`
					: "none",
			}}
		>
			<Show
				when={timelineEvents().length > 0}
				fallback={
					<div class={styles.empty}>
						No events mention {character()?.name} up to this point.
					</div>
				}
			>
				<div class={styles.eventContent}>
					<Show when={currentEvent()}>
						{(ev) => (
							<div class={styles.eventPanel}>
								<h2 class={styles.eventTitle}>{ev().title}</h2>
								<div class={styles.eventText}>{ev().contentPlain ?? ""}</div>
							</div>
						)}
					</Show>
				</div>

				<div class={styles.nav}>
					<IconButton
						label="Previous event"
						onClick={handlePrevClick}
						disabled={currentIndex() === 0}
					>
						<ChevronLeft size={24} />
					</IconButton>

					<span class={styles.position}>
						{currentIndex() + 1} of {timelineEvents().length}
					</span>

					<IconButton
						label="Next event"
						onClick={handleNextClick}
						disabled={currentIndex() === timelineEvents().length - 1}
					>
						<ChevronRight size={24} />
					</IconButton>
				</div>
			</Show>
		</div>
	);
};

export type Selection =
	| { kind: "collection"; id: string }
	| { kind: "chapter"; id: string }
	| { kind: "event"; id: string }
	| { kind: "character"; id: string }
	| null;

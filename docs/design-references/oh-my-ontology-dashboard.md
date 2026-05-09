# oh-my-ontology Dashboard Reference

이 문서는 사용자가 지정한 `<workstation>/side-project/oh-my-ontology` 디자인을 `prompt-coach`에 이식하기 위한 기준이다.

## Source

- `<workstation>/side-project/oh-my-ontology/app/globals.css`
- `<workstation>/side-project/oh-my-ontology/docs/DESIGN-SYSTEM.md`
- `<workstation>/side-project/oh-my-ontology/.claude/rules/design.md`

## Tokens To Port

- Canvas: `#08090a`
- Panel: `#0f1011`
- Elevated: `#191a1b`
- Secondary surface: `#28282c`
- Primary text: `#f7f8f8`
- Secondary text: `#d0d6e0`
- Tertiary text: `#8a8f98`
- Quaternary text: `#787c84`
- Indigo brand: `#5e6ad2`
- Indigo accent: `#7170ff`
- Indigo hover: `#828fff`

## Rules

- 단일 인디고만 제품 accent로 사용한다.
- gradient, glassmorphism, glow, neon, aurora, scale hover를 사용하지 않는다.
- panel은 dark surface + hairline border + compact row로 만든다.
- caption은 mono, 9-11px, uppercase, 높은 tracking으로 둔다.
- `prompt-coach` Dashboard는 ontology map 대신 prompt habit data를 주인공으로 보여준다.

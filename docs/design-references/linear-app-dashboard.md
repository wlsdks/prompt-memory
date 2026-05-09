# Linear-Inspired Dashboard Reference

이 문서는 `<workstation>/ai/awesome-design-md`와 `getdesign linear.app` reference를 `prompt-coach` Dashboard에 맞게 적용한 내부 기준이다. Linear를 복제하지 않고, prompt-coach의 local-first developer tool 정체성에 맞게 번역해서 쓴다.

## 적용할 점

- 첫 화면의 주인공은 장식이 아니라 실제 product UI surface다.
- Dashboard 상단은 한 덩어리의 command surface처럼 보여야 한다.
- 정보는 큰 카드 여러 개보다 hairline separator, compact row, 작은 status pill로 정리한다.
- 가장 중요한 상태 하나를 명확히 크게 보여주고, 바로 옆에 약점과 다음 행동을 둔다.
- accent color는 한 가지 역할에 집중한다. `prompt-coach`에서는 teal을 유지하고, dark command surface 내부에서만 lavender-blue reference를 약하게 빌려 쓴다.
- 그림자보다 1px border와 surface contrast로 깊이를 만든다.

## 적용하지 않을 점

- Linear의 브랜드 색상, 문구, 로고, marketing hero는 복제하지 않는다.
- dashboard 전체를 보라/파랑 gradient theme으로 만들지 않는다.
- 빈 장식, glow, blur orb, nested floating card를 추가하지 않는다.
- prompt body, raw path, secret은 dashboard에 표시하지 않는다.

## Dashboard 판단 기준

- 첫 viewport에서 사용자가 자신의 prompt habit score, 가장 큰 약점, 다음 fix, review queue를 모두 볼 수 있어야 한다.
- 낮은 점수 review queue는 실제 개선 대상만 보여줘야 한다.
- row click은 기존 detail coach 흐름으로 이어져야 한다.
- mobile 390px에서 horizontal overflow가 없어야 한다.

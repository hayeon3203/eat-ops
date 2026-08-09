"use client";

import { CopilotPopup } from "@copilotkit/react-ui";
import { useCopilotReadable } from "@copilotkit/react-core";
import { useGeolocation } from "./useGeolocation";

export function AskAvatar() {
  const { lat, lng } = useGeolocation();

  useCopilotReadable({
    description:
      "사용자의 현재 위치 좌표(위도/경도). '내 위치'나 '내 주변' 같은 표현이 나오면 " +
      "이 좌표를 search_restaurants tool의 lat/lng 인자로 사용하라.",
    value: { lat, lng },
  });

  return (
    <CopilotPopup
      labels={{
        title: "맛집 물어보기",
        initial: "어디 맛집 찾아드릴까요?",
        placeholder: "예: 내 주변 파스타 맛집 추천해줘",
      }}
    />
  );
}

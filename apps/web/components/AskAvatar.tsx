"use client";

import { useCallback } from "react";
import { CopilotPopup, useChatContext } from "@copilotkit/react-ui";
import { useCopilotReadable } from "@copilotkit/react-core";
import { ModelPicker } from "./ModelPicker";
import { useGeolocation } from "./useGeolocation";
import type { Provider } from "./types";

interface AskAvatarProps {
  provider: Provider;
  onProviderChange: (provider: Provider) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** CopilotKit 기본 헤더(제목 + 닫기)에 모델 선택을 얹은 것. 모바일에서는 지도 탭에
 *  있으면 사이드바가 통째로 숨어 있어서, 챗 안에 없으면 모델을 못 바꾼다. */
function ChatHeader({ provider, onProviderChange }: Omit<AskAvatarProps, "open" | "onOpenChange">) {
  const { setOpen, labels, icons } = useChatContext();

  return (
    <div className="copilotKitHeader chat-header">
      <div className="chat-header-main">
        <span className="chat-header-title">{labels.title}</span>
        <ModelPicker provider={provider} onProviderChange={onProviderChange} />
      </div>
      <div className="copilotKitHeaderControls">
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="copilotKitHeaderCloseButton"
        >
          {icons.headerCloseIcon}
        </button>
      </div>
    </div>
  );
}

export function AskAvatar({ provider, onProviderChange, open, onOpenChange }: AskAvatarProps) {
  const { lat, lng } = useGeolocation();

  useCopilotReadable({
    description:
      "사용자의 현재 위치 좌표(위도/경도). '내 위치'나 '내 주변' 같은 표현이 나오면 " +
      "이 좌표를 search_restaurants tool의 lat/lng 인자로 사용하라.",
    value: { lat, lng },
  });

  // CopilotModal은 Header를 컴포넌트 타입으로 받아 useMemo([Header])로 붙든다.
  // 매 렌더 새 함수를 넘기면 타입이 바뀐 것으로 보여 헤더가 remount되고, 열려 있던
  // 모델 드롭다운이 닫힌다. geolocation이 늦게 도착해 이 컴포넌트가 다시 렌더돼도
  // 참조가 유지되도록 useCallback으로 묶는다.
  const Header = useCallback(
    () => <ChatHeader provider={provider} onProviderChange={onProviderChange} />,
    [provider, onProviderChange]
  );

  return (
    <CopilotPopup
      // 모델을 바꾸면 page.tsx의 key={provider}가 여기까지 remount시킨다.
      // 열림 상태를 바깥에 두고 defaultOpen으로 되돌려야 챗이 열린 채로 남는다.
      defaultOpen={open}
      onSetOpen={onOpenChange}
      Header={Header}
      labels={{
        title: "맛집 물어보기",
        initial: "어디 맛집 찾아드릴까요?",
        placeholder: "예: 내 주변 파스타 맛집 추천해줘",
      }}
    />
  );
}

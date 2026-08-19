"use client";

import { useEffect, useRef, useState } from "react";
import type { Provider } from "./types";

interface ModelPickerProps {
  provider: Provider;
  onProviderChange: (provider: Provider) => void;
}

/** 사이드바 헤더와 챗 팝업 헤더가 같은 것을 쓴다. 챗을 지도 탭에서 열면 사이드바가
 *  display:none이라, 여기 하나만 두면 모바일에서는 모델을 바꿀 방법이 없어진다. */
export function ModelPicker({ provider, onProviderChange }: ModelPickerProps) {
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeModelMenu(event: MouseEvent) {
      if (!modelMenuRef.current?.contains(event.target as Node)) setIsModelMenuOpen(false);
    }

    document.addEventListener("mousedown", closeModelMenu);
    return () => document.removeEventListener("mousedown", closeModelMenu);
  }, []);

  const selectedModel = provider === "local" ? "로컬 / EXAONE" : "Foundry / GPT-5 mini";

  function selectModel(nextProvider: Provider) {
    setIsModelMenuOpen(false);
    onProviderChange(nextProvider);
  }

  return (
    <div className="model-picker" ref={modelMenuRef}>
      <button
        type="button"
        className="model-picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={isModelMenuOpen}
        onClick={() => setIsModelMenuOpen((open) => !open)}
      >
        <span>{selectedModel}</span>
        <svg className="model-picker-chevron" viewBox="0 0 16 16" aria-hidden="true">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      <span
        className="info-icon"
        aria-label="모델 안내"
        title={
          "Foundry: Microsoft Foundry에 배포된 GPT-5 mini\n" +
          "로컬: GB10의 vLLM으로 서빙되는 EXAONE-3.0-7.8B"
        }
      >
        ⓘ
      </span>
      {isModelMenuOpen && (
        <div
          className="model-picker-menu"
          role="listbox"
          aria-label="모델 선택"
          onKeyDown={(event) => event.key === "Escape" && setIsModelMenuOpen(false)}
        >
          <button
            type="button"
            role="option"
            aria-selected={provider === "foundry"}
            onClick={() => selectModel("foundry")}
          >
            <span className="model-option-copy">
              <strong>Foundry</strong>
              <small>GPT-5 mini</small>
            </span>
            {provider === "foundry" && <span className="model-option-check">✓</span>}
          </button>
          <button
            type="button"
            role="option"
            aria-selected={provider === "local"}
            onClick={() => selectModel("local")}
          >
            <span className="model-option-copy">
              <strong>로컬</strong>
              <small>EXAONE · GB10 vLLM</small>
            </span>
            {provider === "local" && <span className="model-option-check">✓</span>}
          </button>
        </div>
      )}
    </div>
  );
}

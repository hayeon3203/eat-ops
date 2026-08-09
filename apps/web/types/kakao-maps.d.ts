export {};

// 카카오맵 JS SDK는 별도 @types 패키지가 없어 `any`로만 선언 — SDK 호출부는
// MapView.tsx 안에 한정되므로 여기서 세부 타입을 만드는 비용이 안 맞음.
declare global {
  interface Window {
    kakao: any;
  }
}

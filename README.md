# TAEWOONG 가열로 가스 검침 & 장입도 통합 관리

현장 작업자용 웹앱입니다. 가스 RAW 시계열, 차지별 가스 사용량, 장입도 PDF 검토 데이터를 하나의 흐름으로 관리합니다.

## 구성

- `packages/shared`: 가열로 목록, 교대 경계, 차지번호, TSV 붙여넣기, 사용량 계산 단일 소스
- `apps/api`: Node.js/Express/TypeScript, Prisma/PostgreSQL, JWT/bcrypt, CSV/Excel/PDF 업로드, 집계 캐시
- `apps/web`: React/TypeScript/Vite, TanStack Query, Tailwind, AG Grid, Recharts, PDF.js
- `docker-compose.yml`: PostgreSQL 16, MinIO

## 실행

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:push
npm run db:seed
npm run sample:generate
npm run dev
```

접속:

- Web: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:4000/api/health`
- MinIO console: `http://127.0.0.1:9001`

기본 관리자:

- ID: `admin`
- PW: `admin1234!`

## 주요 기능

- 가스 RAW CSV/Excel 업로드: 파일명에서 호기와 기간 추출, `이력` 시트, 컬럼 검증, `-` 값 null 처리, 5,000행 단위 배치 인서트
- 차지 사용량 그리드: AG Grid 가상 스크롤, 셀 편집, TSV 다중행 붙여넣기, 사용량 실시간 계산, 중복/음수/호기 검증, TSV 라운드트립
- 장입도 PDF: 다중 업로드, PDF 확장자 검증, 페이지별 작업일자/호기/교대/수기 종료시각/재질/중량 입력, PDF.js 뷰어
- 조회/분석: 서버 페이지네이션, 필터, 차트, 차지 선택 시 PDF 연결
- 내보내기: 현재 필터 기준 CSV/Excel
- 권한: `admin`은 업로드/사용자 관리, `user`는 조회/입력/내보내기

## 계산 규칙

- 기준값은 `가스누적지침`
- 차지 사용량은 `사용후 - 사용전`
- 장입도 수기 시간은 작업 종료시각이며 사용후 시각으로 사용
- 같은 호기, 같은 작업일자, 같은 교대 안에서 직전 종료시각이 다음 차지의 사용전 시각
- 직전 종료시각이 없으면 교대 시작 경계 사용
- 기본 교대: 주간 `08:00~19:30`, 야간 `20:00~익일 07:00`
- `19:30~20:00`, `07:00~08:00`은 비근무이며 경고 대상
- 가스 시계열은 요청 시각과 가장 가까운 분 단위 지침을 사용하며 기본 허용 오차는 3분
- 누적지침 감소는 경고로 남기고, 롤오버 최대값을 설정한 계산 호출에서는 보정 가능
- 자동 계산값은 `source=auto`일 때만 재계산으로 덮어쓰며, `manual`/`paste`는 사용자가 입력한 값을 보존

## 데이터베이스

핵심 인덱스:

- `GasReading(furnaceId, ts)` unique/index
- `ChargeRecord(furnaceId, workDate, shift, workEnd)`
- `GasUsage(furnaceId, workDate, shift)`

월 80만 행 이상의 시계열은 PostgreSQL 파티셔닝 또는 TimescaleDB 전환을 권장합니다. 검토 SQL은 `apps/api/prisma/partitioning.sql`에 있습니다.

## 검증

```bash
npm run test
npm run typecheck
npm run build
```

샘플 파일은 `npm run sample:generate`로 `samples/`에 생성됩니다.

import { Module } from "@nestjs/common";
import { PatentDocumentController } from "./patent-document.controller";

/** OA 문서 PDF 중계. 파일 호스트를 밖에 노출하지 않기 위한 얇은 통로 하나다. */
@Module({ controllers: [PatentDocumentController] })
export class PatentDocumentModule {}

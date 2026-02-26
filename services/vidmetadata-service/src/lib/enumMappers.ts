import { VideoStatus as ProtoVideoStatus, FileFormat as ProtoFileFormat } from "@mediapro/proto";
import { VideoStatus, FileFormat } from "../generated/prisma/enums.js";

export function mapVideoStatusToPrisma(status: ProtoVideoStatus): VideoStatus {
    switch(status){
        case ProtoVideoStatus.VIDEO_STATUS_UPLOADED: return VideoStatus.UPLOADED;
        case ProtoVideoStatus.VIDEO_STATUS_PROCESSING: return VideoStatus.PROCESSING;
        case ProtoVideoStatus.VIDEO_STATUS_COMPLETED: return VideoStatus.COMPLETED;
        case ProtoVideoStatus.VIDEO_STATUS_FAILED: return VideoStatus.FAILED;
        default: throw new Error(`Unknown VideoStatus: ${status}`);
    }
}

export function mapFileFormatToPrisma(format: ProtoFileFormat): FileFormat {
    switch(format){
        case ProtoFileFormat.FILE_FORMAT_RAW: return FileFormat.RAW;
        case ProtoFileFormat.FILE_FORMAT_480P: return FileFormat.FORMAT_480P;
        case ProtoFileFormat.FILE_FORMAT_720P: return FileFormat.FORMAT_720P;
        case ProtoFileFormat.FILE_FORMAT_1080P: return FileFormat.FORMAT_1080P;
        case ProtoFileFormat.FILE_FORMAT_THUMBNAIL: return FileFormat.THUMBNAIL;
        case ProtoFileFormat.FILE_FORMAT_POSTER: return FileFormat.POSTER;
        default: throw new Error(`Unknown FileFormat: ${format}`);
    }
}

export function mapVideoStatusToProto(status: VideoStatus): ProtoVideoStatus {
    switch(status){
        case VideoStatus.UPLOADED: return ProtoVideoStatus.VIDEO_STATUS_UPLOADED;
        case VideoStatus.PROCESSING: return ProtoVideoStatus.VIDEO_STATUS_PROCESSING;
        case VideoStatus.COMPLETED: return ProtoVideoStatus.VIDEO_STATUS_COMPLETED;
        case VideoStatus.FAILED: return ProtoVideoStatus.VIDEO_STATUS_FAILED;
        default: throw new Error(`Unknown VideoStatus: ${status}`);
    }
}

export function mapFileFormatToProto(format: FileFormat): ProtoFileFormat {
    switch(format){
        case FileFormat.RAW: return ProtoFileFormat.FILE_FORMAT_RAW;
        case FileFormat.FORMAT_480P: return ProtoFileFormat.FILE_FORMAT_480P;
        case FileFormat.FORMAT_720P: return ProtoFileFormat.FILE_FORMAT_720P;
        case FileFormat.FORMAT_1080P: return ProtoFileFormat.FILE_FORMAT_1080P;
        case FileFormat.THUMBNAIL: return ProtoFileFormat.FILE_FORMAT_THUMBNAIL;
        case FileFormat.POSTER: return ProtoFileFormat.FILE_FORMAT_POSTER;
        default: throw new Error(`Unknown FileFormat: ${format}`);
    }
}
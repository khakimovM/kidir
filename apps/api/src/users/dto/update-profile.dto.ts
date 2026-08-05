import { createZodDto } from "nestjs-zod";
import { zUpdateProfile } from "@kidir/shared";

export class UpdateProfileDto extends createZodDto(zUpdateProfile) {}

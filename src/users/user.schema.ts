import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { Role } from "../common/enums/role.enum.js";

export type UserDocument = HydratedDocument<User>;

@Schema({timestamps: true})
export class User {
    @Prop({ required: true, unique: true, lowercase: true, trim: true })
        email: string;

    @Prop({ required: true, select: false }) //jamais renvoyé par defaut
        password: string;

    @Prop({ required: true, enum: Role, default: Role.USER })
        role: Role;
}

export const UserSchema = SchemaFactory.createForClass(User);
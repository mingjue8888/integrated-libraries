import datetime from "./date";
import env from "./env";
import {JwtPayload, sign, verify} from "jsonwebtoken";
import {compareSync, genSaltSync, hashSync} from "bcrypt";

export class JwtError extends Error {}

export function signToken(userId: string, roles: string, permissions: string, refreshToken?: string) {
    const now = Math.floor(datetime().tz().toDate().getTime() / 1000);
    const accessTokenPayload = {
        sub: userId,
        exp: Math.floor(datetime().tz().add(env.JWT_REFRESH_TIME, "millisecond").toDate().getTime() / 1000),
        iat: now,
        rle: roles,
        prm: permissions,
    };

    if (refreshToken) {
        const refreshTokenPayload = verify(refreshToken, env.JWT_SECRET) as JwtPayload;
        if (refreshTokenPayload.sub !== userId) {
            throw new JwtError("Not the same user");
        }
        if (!refreshTokenPayload.exp) {
            throw new JwtError("Wrong refresh token");
        }
        if (refreshTokenPayload.exp < now) {
            throw new JwtError("Refresh token be overdue");
        }

        return {
            accessToken: sign(accessTokenPayload, env.JWT_SECRET),
            refreshToken,
        };
    }

    const refreshTokenPayload = {
        sub: userId,
        exp: Math.floor(datetime().tz().add(env.JWT_EXPIRES, "millisecond").toDate().getTime() / 1000),
        iat: now,
    };

    return {
        accessToken: sign(accessTokenPayload, env.JWT_SECRET),
        refreshToken: sign(refreshTokenPayload, env.JWT_SECRET),
    };
}

export const PasswordEncryptor = {
    encrypt(password: string) {
        return hashSync(password, genSaltSync());
    },
    verify(password: string, encryptedPassword: string) {
        return compareSync(password, encryptedPassword);
    },
};
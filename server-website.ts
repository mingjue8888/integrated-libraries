import {
    asyncMiddleware,
    defaultExceptionHandler,
    ExpressRouter,
    HttpServerException, Middleware, ServerErrorException,
    startup,
    StartupOptions
} from "./server-http";
import express, {Response} from "express";
import {engine} from "express-handlebars";
import Joi from "joi";

declare global {
    namespace Express {
        interface Response {
            view: string;
            layout?: string;
        }
    }
}

interface WebsiteStartupOptions extends StartupOptions {
    apiPrefix?: string;
}

export function startWebsite(routers: ExpressRouter[], options?: WebsiteStartupOptions) {
    return startup(routers, {
        ...options,
        expandMiddlewares: [
            asyncMiddleware(async function (_request, response) {
                response.status(404).render("404");
            }),
        ],
        preSetting(app) {
            app.engine("handlebars", engine());
            app.set("view engine", "handlebars");
            app.set("views", "./views");
            app.use(express.static("public"));
        },
        rewriteExceptionHandler(error: Error, response: Response) {
            if (options?.apiPrefix) {
                const isApiRequest =
                    response.req.originalUrl.startsWith(options.apiPrefix) ||
                    response.req.originalUrl.startsWith(options.apiPrefix.replace("/", ""));

                if (isApiRequest) {
                    defaultExceptionHandler(error, response);
                    return;
                }
            }

            if (error instanceof HttpServerException) {
                response
                    .status(error.getHttpResponseStatusCode())
                    .render(error.getHttpResponseStatusCode().toString());
            } else {
                response
                    .status(500)
                    .render("500");
            }
        },
    });
}

export function toView(view: string, layout?: string): Middleware {
    return asyncMiddleware(async function (request, response) {
        response.render(view, { user: request.user, layout });
    });
}

export function validRender(schema: Record<string, Joi.AnySchema>): Middleware {
    return asyncMiddleware(async function (request, response) {
        try {
            response.data = Joi.attempt(response.data, Joi.object(schema));
            response.view = Joi.attempt(response.view, Joi.string().required());
            response.layout = Joi.attempt(response.layout, Joi.string());
            response.render(response.view, { user: request.user, data: response.data, layout: response.layout });
        } catch (error) {
            throw new ServerErrorException(`RenderViewError: ${error.details}`);
        }
    });
}
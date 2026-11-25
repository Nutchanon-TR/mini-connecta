import { applyDecorators, type INestApplication } from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';
import contract from '../openapi.snapshot.json' with { type: 'json' };

type Path = keyof typeof contract.paths;
type Method<T extends Path> = keyof (typeof contract.paths)[T];
type ContractOperation = {
  operationId: string;
  summary: string;
  requestBody?: { content: { 'application/json': { schema: { $ref: string } } } };
  responses: Record<
    string,
    { description?: string; content?: { 'application/json': { schema: { $ref: string } } } }
  >;
};

export function operation<T extends Path>(path: T, method: Method<T>) {
  const route: ContractOperation = contract.paths[path][method] as ContractOperation;
  const body = route.requestBody?.content['application/json'].schema;
  return applyDecorators(
    ApiOperation({ operationId: route.operationId, summary: route.summary }),
    ApiCookieAuth('sessionCookie'),
    ...(body ? [ApiBody({ schema: body })] : []),
    ...Object.entries(route.responses).map(([status, response]) =>
      ApiResponse({
        status: Number(status),
        description: response.description,
        schema: response.content?.['application/json'].schema,
      }),
    ),
  );
}

export function buildOpenApi(app: INestApplication) {
  const options = new DocumentBuilder()
    .setTitle(contract.info.title)
    .setVersion(contract.info.version)
    .addCookieAuth('better-auth.session_token', undefined, 'sessionCookie')
    .build();
  const document = SwaggerModule.createDocument(app, options);
  return {
    ...document,
    openapi: contract.openapi,
    paths: Object.fromEntries(
      Object.entries(document.paths).filter(([path]) => path.startsWith('/api/')),
    ),
    components: { ...document.components, schemas: contract.components.schemas },
  };
}

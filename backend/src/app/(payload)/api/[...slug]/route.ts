import config from '@payload-config';
import { REST_GET, REST_POST, REST_DELETE, REST_PATCH, REST_PUT, REST_OPTIONS } from '@payloadcms/next/routes';
import { withAuthContext } from '../../../../auth-context';

export const GET = withAuthContext(REST_GET(config), config);
export const POST = withAuthContext(REST_POST(config), config);
export const DELETE = withAuthContext(REST_DELETE(config), config);
export const PATCH = withAuthContext(REST_PATCH(config), config);
export const PUT = withAuthContext(REST_PUT(config), config);
export const OPTIONS = withAuthContext(REST_OPTIONS(config), config);

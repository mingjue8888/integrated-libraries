import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import weekOfYear from "dayjs/plugin/weekOfYear";
import env from "./env";

dayjs.extend(timezone);
dayjs.extend(utc);
dayjs.extend(quarterOfYear);
dayjs.extend(weekOfYear);
dayjs.tz.setDefault(env.NODE_TIMEZONE);

export default dayjs;
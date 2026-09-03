import { NODE_DIAMETER } from "../../lib/layout";
import "./TreeCanvas.css";

type NodeCircleProps = {
    id: string;
    text: string;
    x: number;
    y: number;
};

export default function NodeCircle({ id, text, x, y }: NodeCircleProps) {
    const radius = NODE_DIAMETER / 2;
    const needsTooltip = text.length > 40;
    return (
        <div
            className="node-circle"
            data-node-id={id}
            title={needsTooltip ? text : undefined}
            style={{
                left: x - radius,
                top: y - radius,
                width: NODE_DIAMETER,
                height: NODE_DIAMETER,
            }}
            aria-label={text}
        >
            <span className="node-circle__text">{text}</span>
        </div>
    );
}

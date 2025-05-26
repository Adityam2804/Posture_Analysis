import React from 'react';
import { Button } from 'antd';
interface ButtonGroupProps {
    onCreate: () => void;
    name: string;
}

const ButtonComponent = ({ onCreate, name }: ButtonGroupProps) => {
    return (
        <div className="flex flex-col items-center justify-center gap-4 p-4">
            <Button
                type="primary"
                htmlType="submit"
                onClick={onCreate}
            >
                {name}
            </Button>
        </div>
    );
};

export default ButtonComponent;

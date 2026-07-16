import React from "react";
import "./css/styles.css";

const Boot64 = ({ message = null }) => {
    return (
        <div className="boot64">
            <div className="boot64-content">
                <h1 className="boot64-logo">UselessOS</h1>

                <div className="boot64-progress">
                    <div className="boot64-progress-fill"></div>
                </div>

                {message ? (
                    <div
                        style={{
                            marginTop: 10,
                            fontSize: 13,
                            color: "#8d8d8d",
                            letterSpacing: "0.02em",
                        }}
                    >
                        {message}
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default Boot64;
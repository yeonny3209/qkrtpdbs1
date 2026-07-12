import streamlit as st
import streamlit.components.v1 as components
import random
import json
import os
import time

# ==========================================
# 1. 홈 화면 페이지
# ==========================================
def home_page():
    st.title("🌟 환영합니다! 세윤이의 게임 월드.")
    st.subheader("스트림릿(Streamlit)으로 만든 멋진 첫 화면에 오신 것을 환영해요!")
    st.divider()
    
    col1, col2 = st.columns(2)
    with col1:
        st.write("### 💡 이 앱에 대하여")
        st.write("""
        이곳에는 웹페이지의 소개글이나 사용 방법을 적을 수 있어.
        스트림릿은 복잡한 HTML이나 CSS 없이 파이썬만으로도 
        이렇게 훌륭한 UI를 만들 수 있게 해 주는 아주 강력한 도구야.
        """)
    with col2:
        st.write("### 🛠️ 기능 테스트")
        st.write("간단한 버튼과 입력창을 테스트해 볼 수 있어.")
        user_name = st.text_input("이름을 입력해 보세요!")
        if st.button("인사하기"):
            if user_name:
                st.success(f"반가워요, {user_name}님! 멋진 프로그래밍을 응원할게요!")
            else:
                st.warning("이름을 먼저 입력해 주세요.")

# ==========================================
# 2. 업다운 게임 페이지
# ==========================================
def game_page():
    st.title("🎮 업다운(Up-Down) 게임")
    st.write("컴퓨터가 1부터 100 사이의 숫자 하나를 생각했습니다. 맞춰보세요!")

    if "target_number" not in st.session_state:
        st.session_state.target_number = random.randint(1, 100)
        st.session_state.game_over = False
        st.session_state.attempts = 0

    with st.form(key="updown_form", clear_on_submit=False):
        user_input = st.text_input("숫자를 입력하고 엔터를 누르세요 (1~100)")
        submit_button = st.form_submit_button(label="정답 확인")

    if submit_button:
        if user_input.isdigit():
            user_guess = int(user_input)
            
            if not st.session_state.game_over:
                st.session_state.attempts += 1
                
                if user_guess < st.session_state.target_number:
                    st.info(f"🔺 UP! 컴퓨터가 생각한 숫자가 더 큽니다. (시도 횟수: {st.session_state.attempts}회)")
                elif user_guess > st.session_state.target_number:
                    st.info(f"🔻 DOWN! 컴퓨터가 생각한 숫자가 더 작습니다. (시도 횟수: {st.session_state.attempts}회)")
                else:
                    st.success(f"🎉 정답입니다! {st.session_state.attempts}번 만에 맞추셨습니다!")
                    st.session_state.game_over = True
            else:
                st.warning("게임이 끝났습니다. 새로운 게임을 시작하려면 아래 재시작 버튼을 눌러주세요.")
        else:
            st.error("숫자만 정확하게 입력해 주세요!")

    if st.button("게임 재시작"):
        st.session_state.target_number = random.randint(1, 100)
        st.session_state.game_over = False
        st.session_state.attempts = 0
        st.rerun()

# ==========================================
# 3. 뱀사다리 말판 게임 페이지
# ==========================================
def board_page():
    st.title("🎲 뱀사다리 말판 게임 (1~50)")
    st.write("주사위를 굴려 가장 먼저 50번 칸에 도착하는 사람이 승리합니다!")
    
    ladders = {3: 15, 12: 28, 20: 34, 31: 43}
    snakes = {18: 6, 32: 10, 41: 25, 48: 22}
    emojis = ["🔴", "🔵", "🟡", "🟢"]

    if "board_players" not in st.session_state:
        st.session_state.board_players = 2
    if "positions" not in st.session_state:
        st.session_state.positions = [1, 1, 1, 1]
    if "turn" not in st.session_state:
        st.session_state.turn = 0
    if "log" not in st.session_state:
        st.session_state.log = ["게임을 시작합니다!"]
    if "winner" not in st.session_state:
        st.session_state.winner = None
    if "custom_names" not in st.session_state:
        st.session_state.custom_names = ["플레이어 1", "플레이어 2", "플레이어 3", "플레이어 4"]

    st.subheader("👥 게임 인원 및 이름 설정")
    new_num_players = st.selectbox("참여할 플레이어 수를 선택하세요", [2, 3, 4], index=st.session_state.board_players - 2, key="board_p_select")
    
    if new_num_players != st.session_state.board_players:
        st.session_state.board_players = new_num_players
        st.session_state.positions = [1, 1, 1, 1]
        st.session_state.turn = 0
        st.session_state.log = ["인원이 변경되어 게임을 리셋합니다!"]
        st.session_state.winner = None
        st.rerun()

    name_cols = st.columns(st.session_state.board_players)
    for i in range(st.session_state.board_players):
        with name_cols[i]:
            st.session_state.custom_names[i] = st.text_input(f"{emojis[i]} 이름 입력", value=st.session_state.custom_names[i], key=f"p_name_{i}")

    display_names = [f"{emojis[i]} {st.session_state.custom_names[i]}" for i in range(st.session_state.board_players)]

    st.divider()

    st.subheader("🗺️ 실시간 게임 보드판")
    board_html = "<div style='display: grid; grid-template-columns: repeat(10, 1fr); gap: 6px; background-color: #f5f5f5; padding: 15px; border-radius: 12px; border: 2px solid #ccc; max-width: 900px; margin: auto;'>"
    
    for r in range(4, -1, -1):
        for c in range(10):
            num = r * 10 + 1 + c if r % 2 == 0 else r * 10 + 10 - c
            
            present_players = ""
            for p_idx in range(st.session_state.board_players):
                if st.session_state.positions[p_idx] == num:
                    present_players += emojis[p_idx]
            
            bg_color = "#ffffff"
            note = ""
            border_style = "1px solid #ddd"
            
            if num == 1:
                bg_color = "#fff9db"
                note = "START"
                border_style = "2px solid #fcc419"
            elif num == 50:
                bg_color = "#e3fafc"
                note = "GOAL"
                border_style = "2px solid #22b8cf"
            elif num in ladders:
                note = f"🪜 ➔ {ladders[num]}"
                bg_color = "#ebfbee"
            elif num in snakes:
                note = f"🐍 ➔ {snakes[num]}"
                bg_color = "#fff5f5"
            
            cell_style = f"background-color: {bg_color}; border: {border_style}; border-radius: 8px; padding: 6px; text-align: center; min-height: 75px; display: flex; flex-direction: column; justify-content: space-between;"
            board_html += f"<div style='{cell_style}'>"
            board_html += f"<div style='font-size: 12px; font-weight: bold; color: #495057; text-align: left;'>{num}</div>"
            board_html += f"<div style='font-size: 18px; margin: 2px 0; min-height: 24px;'>{present_players}</div>"
            board_html += f"<div style='font-size: 9px; color: #868e96; font-weight: bold;'>{note}</div>"
            board_html += "</div>"
            
    board_html += "</div>"
    st.markdown(board_html, unsafe_allow_html=True)

    st.divider()

    cols = st.columns(st.session_state.board_players)
    for i in range(st.session_state.board_players):
        with cols[i]:
            st.metric(label=display_names[i], value=f"{st.session_state.positions[i]}번 칸")

    st.divider()

    if st.session_state.winner:
        st.success(f"🎉 축하합니다! {st.session_state.winner} 팀이 승리했습니다!")
    else:
        st.subheader(f"👉 현재 차례: {display_names[st.session_state.turn]}")
        if st.button("🎲 주사위 던지기", key="roll_dice_btn"):
            dice_roll = random.randint(1, 6)
            old_pos = st.session_state.positions[st.session_state.turn]
            new_pos = old_pos + dice_roll
            log_msg = f"{display_names[st.session_state.turn]}이(가) 주사위 {dice_roll}을(를) 굴렸습니다. ({old_pos} ➔ {new_pos})"
            
            if new_pos >= 50:
                st.session_state.positions[st.session_state.turn] = 50
                st.session_state.winner = display_names[st.session_state.turn]
                st.session_state.log.insert(0, log_msg + " 🏁 골인!!")
            else:
                if new_pos in ladders:
                    log_msg += f" 🪜 사다리! {new_pos}번에서 {ladders[new_pos]}번으로 이동!"
                    new_pos = ladders[new_pos]
                elif new_pos in snakes:
                    log_msg += f" 🐍 뱀이다! {new_pos}번에서 {snakes[new_pos]}번으로 미끄러짐..."
                    new_pos = snakes[new_pos]
                
                st.session_state.positions[st.session_state.turn] = new_pos
                st.session_state.log.insert(0, log_msg)
                st.session_state.turn = (st.session_state.turn + 1) % st.session_state.board_players
            st.rerun()

    if st.button("🔄 게임 처음부터 다시 시작", key="reset_board_btn"):
        st.session_state.positions = [1, 1, 1, 1]
        st.session_state.turn = 0
        st.session_state.log = ["게임을 리셋했습니다!"]
        st.session_state.winner = None
        st.rerun()

    for msg in st.session_state.log[:5]:
        st.write(msg)


# ==========================================
# 4. 쿼리도 두뇌 게임 페이지
# ==========================================
def check_path(start, p_idx, num_p, h_walls, v_walls):
    queue = [start]
    visited = {tuple(start)}
    while queue:
        r, c = queue.pop(0)
        if p_idx == 0 and r == 0: return True
        if p_idx == 1 and r == 8: return True
        if p_idx == 2 and c == 8: return True
        if p_idx == 3 and c == 0: return True
        
        if r > 0 and (r-1, c) not in visited and not h_walls[r-1][c]:
            visited.add((r-1, c))
            queue.append([r-1, c])
        if r < 8 and (r+1, c) not in visited and not h_walls[r][c]:
            visited.add((r+1, c))
            queue.append([r+1, c])
        if c > 0 and (r, c-1) not in visited and not v_walls[r][c-1]:
            visited.add((r, c-1))
            queue.append([r, c-1])
        if c < 8 and (r, c+1) not in visited and not v_walls[r][c]:
            visited.add((r, c+1))
            queue.append([r, c+1])
    return False

def check_all_paths(positions, num_p, h_walls, v_walls):
    for i in range(num_p):
        if not check_path(positions[i], i, num_p, h_walls, v_walls):
            return False
    return True

def quoridor_page():
    st.title("🧱 🧠 전략 두뇌 게임: 쿼리도")
    emojis = ["🔴", "🔵", "🟡", "🟢"]
    
    if "q_players" not in st.session_state: st.session_state.q_players = 2
    if "q_positions" not in st.session_state: st.session_state.q_positions = [[8, 4], [0, 4], [4, 0], [4, 8]]
    if "q_walls_h" not in st.session_state: st.session_state.q_walls_h = [[False]*9 for _ in range(8)]
    if "q_walls_v" not in st.session_state: st.session_state.q_walls_v = [[False]*8 for _ in range(9)]
    if "q_wall_counts" not in st.session_state: st.session_state.q_wall_counts = [10, 10, 5, 5]
    if "q_turn" not in st.session_state: st.session_state.q_turn = 0
    if "q_winner" not in st.session_state: st.session_state.q_winner = None
    if "q_names" not in st.session_state: st.session_state.q_names = ["플레이어 1", "플레이어 2", "플레이어 3", "플레이어 4"]
    if "q_log" not in st.session_state: st.session_state.q_log = ["게임을 시작합니다!"]

    new_num = st.selectbox("참여할 플레이어 수를 선택하세요", [2, 4], index=0 if st.session_state.q_players == 2 else 1, key="q_p_select")
    if new_num != st.session_state.q_players:
        st.session_state.q_players = new_num
        st.session_state.q_positions = [[8, 4], [0, 4], [4, 0], [4, 8]]
        st.session_state.q_walls_h = [[False]*9 for _ in range(8)]
        st.session_state.q_walls_v = [[False]*8 for _ in range(9)]
        st.session_state.q_wall_counts = [10, 10, 5, 5] if new_num == 2 else [5, 5, 5, 5]
        st.session_state.q_turn = 0
        st.session_state.q_winner = None
        st.rerun()

    name_cols = st.columns(st.session_state.q_players)
    for i in range(st.session_state.q_players):
        st.session_state.q_names[i] = name_cols[i].text_input(f"{emojis[i]} 이름", value=st.session_state.q_names[i], key=f"q_name_{i}")

    st.divider()
    
    board_html = "<div style='display: grid; grid-template-columns: repeat(9, 1fr); gap: 0px; background-color: #343a40; padding: 12px; border-radius: 12px; max-width: 450px; margin: auto;'>"
    for r in range(9):
        for c in range(9):
            cell_p = ""
            for p_idx in range(st.session_state.q_players):
                if st.session_state.q_positions[p_idx] == [r, c]: cell_p = emojis[p_idx]
            b_bottom = "2px solid #495057"
            b_right = "2px solid #495057"
            if r < 8 and st.session_state.q_walls_h[r][c]: b_bottom = "6px solid #ff8787"
            if c < 8 and st.session_state.q_walls_v[r][c]: b_right = "6px solid #ff8787"
            bg = "#212529"
            if r == 0: bg = "#2b3b4c"
            elif r == 8: bg = "#4c3b2b"
            cell_style = f"background-color: {bg}; border-bottom: {b_bottom}; border-right: {b_right}; width: 100%; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; font-size: 20px;"
            board_html += f"<div style='{cell_style}'>{cell_p}</div>"
    board_html += "</div>"
    st.markdown(board_html, unsafe_allow_html=True)

    st.divider()
    status_cols = st.columns(st.session_state.q_players)
    for i in range(st.session_state.q_players):
        status_cols[i].metric(label=st.session_state.q_names[i], value=f"벽 {st.session_state.q_wall_counts[i]}개")

    if st.session_state.q_winner:
        st.success(f"🎉 {st.session_state.q_winner}님 승리!")
    else:
        curr = st.session_state.q_turn
        st.subheader(f"👉 차례: {emojis[curr]} {st.session_state.q_names[curr]}")
        action = st.radio("행동", ["말 이동", "벽 설치"], horizontal=True, key="q_act")
        cr, cc = st.session_state.q_positions[curr]
        
        if action == "말 이동":
            m_cols = st.columns(4)
            if m_cols[0].button("⬆️ 위", disabled=not (cr > 0 and not st.session_state.q_walls_h[cr-1][cc]), key="qu"):
                st.session_state.q_positions[curr] = [cr-1, cc]
                if curr == 0 and cr-1 == 0: st.session_state.q_winner = st.session_state.q_names[curr]
                st.session_state.q_turn = (curr + 1) % st.session_state.q_players
                st.rerun()
            if m_cols[1].button("⬇️ 아래", disabled=not (cr < 8 and not st.session_state.q_walls_h[cr][cc]), key="qd"):
                st.session_state.q_positions[curr] = [cr+1, cc]
                if curr == 1 and cr+1 == 8: st.session_state.q_winner = st.session_state.q_names[curr]
                st.session_state.q_turn = (curr + 1) % st.session_state.q_players
                st.rerun()
            if m_cols[2].button("⬅️ 왼쪽", disabled=not (cc > 0 and not st.session_state.q_walls_v[cr][cc-1]), key="ql"):
                st.session_state.q_positions[curr] = [cr, cc-1]
                if curr == 3 and cc-1 == 0: st.session_state.q_winner = st.session_state.q_names[curr]
                st.session_state.q_turn = (curr + 1) % st.session_state.q_players
                st.rerun()
            if m_cols[3].button("➡️ 오른쪽", disabled=not (cc < 8 and not st.session_state.q_walls_v[cr][cc]), key="qr"):
                st.session_state.q_positions[curr] = [cr, cc+1]
                if curr == 2 and cc+1 == 8: st.session_state.q_winner = st.session_state.q_names[curr]
                st.session_state.q_turn = (curr + 1) % st.session_state.q_players
                st.rerun()
        else:
            w_type = st.selectbox("종류", ["가로 벽", "세로 벽"])
            w_row = st.number_input("행 (1~8)", 1, 8, 1) - 1
            w_col = st.number_input("열 (1~8)", 1, 8, 1) - 1
            if st.button("🧱 벽 설치"):
                ok = False
                if "가로" in w_type:
                    if not st.session_state.q_walls_h[w_row][w_col] and not st.session_state.q_walls_h[w_row][w_col+1]:
                        st.session_state.q_walls_h[w_row][w_col] = True
                        st.session_state.q_walls_h[w_row][w_col+1] = True
                        if check_all_paths(st.session_state.q_positions, st.session_state.q_players, st.session_state.q_walls_h, st.session_state.q_walls_v): ok = True
                        else:
                            st.session_state.q_walls_h[w_row][w_col] = False
                            st.session_state.q_walls_h[w_row][w_col+1] = False
                else:
                    if not st.session_state.q_walls_v[w_row][w_col] and not st.session_state.q_walls_v[w_row+1][w_col]:
                        st.session_state.q_walls_v[w_row][w_col] = True
                        st.session_state.q_walls_v[w_row+1][w_col] = True
                        if check_all_paths(st.session_state.q_positions, st.session_state.q_players, st.session_state.q_walls_h, st.session_state.q_walls_v): ok = True
                        else:
                            st.session_state.q_walls_v[w_row][w_col] = False
                            st.session_state.q_walls_v[w_row+1][w_col] = False
                if ok:
                    st.session_state.q_wall_counts[curr] -= 1
                    st.session_state.q_turn = (curr + 1) % st.session_state.q_players
                    st.rerun()
                else: st.error("벽을 놓을 수 없거나 길을 완전히 막습니다!")


# ==========================================
# 5. RPG 게임 도우미 데이터 & 함수
# ==========================================
SAVE_FILE = "rpg_save_data.json"

# 글로벌 스킬 사전 정의 데이터베이스
ALL_SKILLS = {
    "⚡ 질풍 연격": {"price": 250, "cd": 2, "desc": "신속하게 2단 타격! 공격력의 1.8배 대미지"},
    "🔱 성운 붕괴 폭발": {"price": 850, "cd": 4, "desc": "적 방어력을 100% 무시하고 공격력의 3.2배 고정 대미지"},
    "💖 흡혈귀의 군주": {"price": 500, "cd": 3, "desc": "적에게 1.3배의 피해를 주고, 가한 피해량의 40%만큼 체력 회복"},
    "🛡️ 갓 가디언 실드": {"price": 400, "cd": 3, "desc": "적에게 0.8배 피해를 입히고, 자신의 체력을 60만큼 즉시 치유"},
    "🎯 백발백중 신성창": {"price": 1200, "cd": 3, "desc": "급소를 관통해 공격력의 2.6배 대미지 부여"}
}

def save_rpg():
    data = {
        "lvl": st.session_state.r_lvl,
        "exp": st.session_state.r_exp,
        "max_exp": st.session_state.r_max_exp,
        "gold": st.session_state.r_gold,
        "max_hp": st.session_state.r_max_hp,
        "hp": st.session_state.r_hp,
        "b_atk": st.session_state.r_b_atk,
        "b_def": st.session_state.r_b_def,
        "w_name": st.session_state.r_w_name,
        "w_atk": st.session_state.r_w_atk,
        "w_enhance": st.session_state.r_w_enhance,
        "a_name": st.session_state.r_a_name,
        "a_def": st.session_state.r_a_def,
        "a_enhance": st.session_state.r_a_enhance,
        "skills_owned": st.session_state.r_skills_owned,
        "skills_equipped": st.session_state.r_skills_equipped
    }
    with open(SAVE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

def load_rpg():
    if os.path.exists(SAVE_FILE):
        with open(SAVE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        st.session_state.r_lvl = data.get("lvl", 1)
        st.session_state.r_exp = data.get("exp", 0)
        st.session_state.r_max_exp = data.get("max_exp", 10)
        st.session_state.r_gold = data.get("gold", 50)
        st.session_state.r_max_hp = data.get("max_hp", 60)
        st.session_state.r_hp = data.get("hp", 60)
        st.session_state.r_b_atk = data.get("b_atk", 10)
        st.session_state.r_b_def = data.get("b_def", 2)
        st.session_state.r_w_name = data.get("w_name", "낡은 나뭇가지")
        st.session_state.r_w_atk = data.get("w_atk", 0)
        st.session_state.r_w_enhance = data.get("w_enhance", 0)
        st.session_state.r_a_name = data.get("a_name", "천 옷")
        st.session_state.r_a_def = data.get("a_def", 0)
        st.session_state.r_a_enhance = data.get("a_enhance", 0)
        st.session_state.r_skills_owned = data.get("skills_owned", [])
        st.session_state.r_skills_equipped = data.get("skills_equipped", [])
        return True
    return False

def enemy_turn_process(m, total_def):
    # 전장에 장착하고 들어온 스킬들의 개별 쿨타임 관리
    for s_name in st.session_state.r_cds:
        if st.session_state.r_cds[s_name] > 0:
            st.session_state.r_cds[s_name] -= 1

    # 1. 보스 몬스터 사망 판정
    if m["hp"] <= 0:
        st.session_state.r_battle = False
        st.session_state.r_gold += m["gold"]
        st.session_state.r_exp += m["exp"]
        st.session_state.r_log.insert(0, f"🏆 [보스 토벌 대성공] {m['name']} 클리어! 보상: 💰 {m['gold']}G / ✨ {m['exp']}EXP")
        
        # 레벨업 판정
        if st.session_state.r_exp >= st.session_state.r_max_exp:
            st.session_state.r_lvl += 1
            st.session_state.r_exp -= st.session_state.r_max_exp
            st.session_state.r_max_exp = int(st.session_state.r_max_exp * 1.5)
            st.session_state.r_max_hp += 35
            st.session_state.r_b_atk += 8
            st.session_state.r_b_def += 5
            st.session_state.r_hp = st.session_state.r_max_hp
            st.session_state.r_log.insert(0, f"🎉 LEVEL UP! Lv.{st.session_state.r_lvl} 달성! 최대 체력 및 기초 공격/방어 스탯 상승.")
        save_rpg()
        return

    # 2. 보스의 반격 턴
    m_dmg = max(1, m["atk"] - total_def)
    st.session_state.r_hp -= m_dmg
    st.session_state.r_log.insert(0, f"💥 [{m['name']}]의 위협적인 반격! {m_dmg}의 대미지를 입었습니다.")

    # 3. 용사 사망 판정
    if st.session_state.r_hp <= 0:
        st.session_state.r_battle = False
        st.session_state.r_hp = int(st.session_state.r_max_hp * 0.3) # 30% 체력으로 복귀
        p_lost = int(st.session_state.r_gold * 0.1) # 10% 골드 패널티
        st.session_state.r_gold -= p_lost
        st.session_state.r_log.insert(0, f"💀 전사하셨습니다... 안전지대에서 부활했습니다. 패널티로 소지 골드 가치가 감소합니다 (-{p_lost}G)")
        save_rpg()


# ==========================================
# 6. 메인 RPG 게임 화면 페이지
# ==========================================
def _legacy_rpg_page():  # (구) 성장형 RPG — 9속성 타워 디펜스로 대체됨. 미사용.
    st.title("⚔️ 전설의 용사 키우기 (Ver 3.0 Custom)")
    st.write("자신만의 스킬셋을 세팅하고 장비를 한계까지 강화하여 10대 군주 보스들을 처단하세요!")

    # 세션 상태 안전 개별 초기화 딕셔너리
    defaults = {
        "r_lvl": 1,
        "r_exp": 0,
        "r_max_exp": 10,
        "r_gold": 100,
        "r_max_hp": 60,
        "r_hp": 60,
        "r_b_atk": 10,
        "r_b_def": 2,
        "r_w_name": "낡은 나뭇가지",
        "r_w_atk": 0,
        "r_w_enhance": 0,
        "r_a_name": "천 옷",
        "r_a_def": 0,
        "r_a_enhance": 0,
        "r_skills_owned": [],
        "r_skills_equipped": [],
        "r_cds": {},
        "r_log": ["새로운 월드에 오신 것을 환영합니다."],
        "r_battle": False,
        "m_cur": None
    }

    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value

    # [💡 고품질 스탯 계산 공식] 강화 수치를 적용한 동적 수치 계산
    # 무기강화당 ATK +8, 방어구강화당 DEF +5 보너스 가산
    enhance_atk_bonus = st.session_state.r_w_enhance * 8
    enhance_def_bonus = st.session_state.r_a_enhance * 5
    
    total_atk = st.session_state.r_b_atk + st.session_state.r_w_atk + enhance_atk_bonus
    total_def = st.session_state.r_b_def + st.session_state.r_a_def + enhance_def_bonus

    # 대시보드 UI 프로필 스탯 노출
    st.subheader("👤 용사 스탯 멀티 정보창")
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("종합 레벨", f"Lv.{st.session_state.r_lvl}")
    c2.metric("자금 잔고", f"💰 {st.session_state.r_gold} G")
    
    w_enh_text = f"(+{st.session_state.r_w_enhance})" if st.session_state.r_w_enhance > 0 else ""
    c3.metric("총 공격력", f"⚔️ {total_atk}", f"기본+{st.session_state.r_w_atk} {w_enh_text}")
    
    a_enh_text = f"(+{st.session_state.r_a_enhance})" if st.session_state.r_a_enhance > 0 else ""
    c4.metric("총 방어력", f"🛡️ {total_def}", f"기본+{st.session_state.r_a_def} {a_enh_text}")

    st.write(f"❤️ **HP 게이지:** {st.session_state.r_hp} / {st.session_state.r_max_hp}")
    st.progress(max(0.0, min(1.0, st.session_state.r_hp / st.session_state.r_max_hp)))
    st.write(f"✨ **경험치 잔량:** {st.session_state.r_exp} / {st.session_state.r_max_exp}")
    st.progress(max(0.0, min(1.0, st.session_state.r_exp / st.session_state.r_max_exp)))

    st.divider()

    tab1, tab2, tab3, tab4 = st.tabs([
        "🏹 10대 정예 보스 토벌", 
        "🛒 무기/방어구 대장간 & 강화소", 
        "📜 스킬 커스텀 및 무공 관리실", 
        "💾 모험의 서 파일 입출력"
    ])

    # ------------------------------------------
    # Tab 1: 10마리의 순차적 랜드마크 보스 레이드
    # ------------------------------------------
    with tab1:
        boss_ladder = {
            "👹 [BOSS 01] 하급 슬라임 킹": {"hp": 60, "atk": 5, "def": 2, "exp": 5, "gold": 40},
            "🐺 [BOSS 02] 광포한 우두머리 늑대": {"hp": 180, "atk": 25, "def": 8, "exp": 15, "gold": 120},
            "🦂 [BOSS 03] 사막의 맹독 지배자": {"hp": 450, "atk": 50, "def": 22, "exp": 40, "gold": 300},
            "🧟 [BOSS 04] 저주받은 백골 기사관": {"hp": 1100, "atk": 95, "def": 48, "exp": 90, "gold": 750},
            "🤖 [BOSS 05] 무너진 고대 문명 수호 기갑": {"hp": 2400, "atk": 180, "def": 90, "exp": 200, "gold": 1500},
            "🦅 [BOSS 06] 천공의 오염된 하피 퀸": {"hp": 5000, "atk": 320, "def": 170, "exp": 450, "gold": 3000},
            "🌋 [BOSS 07] 지옥 심연의 용암 고렘": {"hp": 11000, "atk": 540, "def": 310, "exp": 1000, "gold": 5000},
            "❄️ [BOSS 08] 영구 동토의 서리 마녀": {"hp": 24000, "atk": 880, "def": 520, "exp": 2200, "gold": 8000},
            "👑 [BOSS 09] 타락한 황실 영혼 군주": {"hp": 55000, "atk": 1450, "def": 850, "exp": 5000, "gold": 12000},
            "🔥 [BOSS 10] 세계선 종언의 성광 드래곤": {"hp": 120000, "atk": 2500, "def": 1400, "exp": 20000, "gold": 30000}
        }

        if not st.session_state.r_battle:
            st.write("### 🏹 도전할 보스 대상을 선택하십시오:")
            b_choice = st.selectbox("전설급 보스 리스트업", list(boss_ladder.keys()))
            
            equipped_count = len(st.session_state.r_skills_equipped)
            st.info(f"현재 전투용 슬롯에 배치된 스킬 수: **{equipped_count}개** (최대 2개 배치 가능)")
            
            if st.button("⚔️ 보스 결계 룸 진입하기"):
                st.session_state.m_cur = boss_ladder[b_choice].copy()
                st.session_state.m_cur["name"] = b_choice
                st.session_state.m_cur["max_hp"] = boss_ladder[b_choice]["hp"]
                st.session_state.r_battle = True
                
                # 진입 시 전투에 세팅된 스킬의 쿨타임 컴포넌트 초기화
                st.session_state.r_cds = {s: 0 for s in st.session_state.r_skills_equipped}
                st.session_state.r_log.insert(0, f"⚔️ {b_choice}의 진영에 난입했습니다! 生과 死의 전투가 전개됩니다.")
                st.rerun()
        else:
            m = st.session_state.m_cur
            st.error(f"👿 극도로 위협적인 보스 **{m['name']}** 와 혈투 중!")
            st.write(f"💥 **보스 잔여 체력:** {m['hp']} / {m['max_hp']}")
            st.progress(max(0.0, min(1.0, m["hp"] / m["max_hp"])))

            # 장착된 스킬의 개수에 맞춰 다이내믹하게 버튼 가로 레이아웃 배치 (기본 공격 1개 + 장착 스킬 수)
            num_buttons = 1 + len(st.session_state.r_skills_equipped)
            btn_cols = st.columns(num_buttons + 1) # 퇴각 버튼 공간 하나 추가
            
            # 1. 기본 공격 버튼
            if btn_cols[0].button("🗡️ 평타 공격", use_container_width=True):
                p_dmg = max(1, total_atk - m["def"])
                m["hp"] -= p_dmg
                st.session_state.r_log.insert(0, f"⚔️ 용사의 일격! [{m['name']}]에게 {p_dmg}의 대미지 적중.")
                enemy_turn_process(m, total_def)
                st.rerun()

            # 2. 유저가 커스텀하게 장착하고 들어온 스킬 버튼들 동적 배치
            for idx, s_name in enumerate(st.session_state.r_skills_equipped):
                cd_val = st.session_state.r_cds.get(s_name, 0)
                btn_label = f"{s_name}"
                if cd_val > 0:
                    btn_label += f" ({cd_val}턴 대기)"
                
                is_disabled = cd_val > 0
                if btn_cols[idx + 1].button(btn_label, disabled=is_disabled, use_container_width=True):
                    # 각 스킬 이름별 실시간 메커니즘 연산식 분기 처리
                    p_dmg = 0
                    log_text = ""
                    
                    if s_name == "⚡ 질풍 연격":
                        p_dmg = max(1, int(total_atk * 1.8) - m["def"])
                        log_text = f"⚡ [질풍 연격 시전] 신속하게 두 번 베어 {p_dmg}의 큰 대미지를 날렸습니다!"
                    elif s_name == "🔱 성운 붕괴 폭발":
                        p_dmg = int(total_atk * 3.2) # 방어 100% 무시
                        log_text = f"🔱 [성운 붕괴 폭발 시전] 장갑을 완전 무시하고 {p_dmg}의 치명적 고정 피해를 선사했습니다!"
                    elif s_name == "💖 흡혈귀의 군주":
                        p_dmg = max(1, int(total_atk * 1.3) - m["def"])
                        heal_amt = int(p_dmg * 0.4)
                        st.session_state.r_hp = min(st.session_state.r_max_hp, st.session_state.r_hp + heal_amt)
                        log_text = f"💖 [흡혈귀의 군주 시전] 적에게 {p_dmg} 피해를 입히고 내 체력을 +{heal_amt} 흡수했습니다!"
                    elif s_name == "🛡️ 갓 가디언 실드":
                        p_dmg = max(1, int(total_atk * 0.8) - m["def"])
                        st.session_state.r_hp = min(st.session_state.r_max_hp, st.session_state.r_hp + 60)
                        log_text = f"🛡️ [갓 가디언 실드 시전] 방어막을 쳐 {p_dmg} 피해를 주고 체력을 즉시 +60 치유했습니다."
                    elif s_name == "🎯 백발백중 신성창":
                        p_dmg = max(1, int(total_atk * 2.6) - m["def"])
                        log_text = f"🎯 [백발백중 신성창 시전] 적의 급소에 일격을 꽂아 {p_dmg}의 치명타를 주었습니다."
                    
                    m["hp"] -= p_dmg
                    st.session_state.r_cds[s_name] = ALL_SKILLS[s_name]["cd"]
                    st.session_state.r_log.insert(0, log_text)
                    enemy_turn_process(m, total_def)
                    st.rerun()

            # 마지막 칸 퇴각 단추 배치
            if btn_cols[-1].button("🏃 도망치기", use_container_width=True):
                st.session_state.r_battle = False
                st.session_state.r_log.insert(0, "💨 위협적인 기운에 밀려 전투에서 이탈했습니다.")
                st.rerun()

    # ------------------------------------------
    # Tab 2: 상점 보급소 & 장비 인챈트 강화 시스템
    # ------------------------------------------
    with tab2:
        st.subheader("🛒 최고급 장비 보급 대장간")
        st.write("골드를 지불해 더욱 강력한 등급의 장비를 영구 교체 획득할 수 있습니다.")
        
        # 10,000원 아이템을 종결로 하는 균형 잡힌 무기 상점 데이터
        w_shop = [
            {"name": "⚔️ 단단한 정련 철검", "atk": 20, "price": 150},
            {"name": "🔱 마력을 주입한 창", "atk": 65, "price": 600},
            {"name": "☄️ 성광의 천공 대검", "atk": 160, "price": 2000},
            {"name": "🔥 드래곤 오리진 슬레이어", "atk": 380, "price": 5000},
            {"name": "🌌 종언을 고하는 창조의 검", "atk": 850, "price": 10000}
        ]
        
        # 10,000원 아이템을 종결로 하는 균형 잡힌 방어구 상점 데이터
        a_shop = [
            {"name": "🧥 야전 이중 가죽갑옷", "def": 10, "price": 180},
            {"name": "⛓️ 팔라딘 중전 사슬갑", "def": 35, "price": 650},
            {"name": "🔱 티타늄 풀플레이트 아머", "def": 90, "price": 2200},
            {"name": "🌌 오로라 불멸의 성해 아머", "def": 210, "price": 5200},
            {"name": "👑 절대존엄 성황의 천신갑", "def": 480, "price": 10000}
        ]

        st.write(f"현재 무기: **{st.session_state.r_w_name}** | 현재 방어구: **{st.session_state.r_a_name}**")
        
        w_tab, a_tab, enh_tab = st.tabs(["⚔️ 무기 상점", "🛡️ 방어구 상점", "💎 장비 강화소"])
        
        with w_tab:
            wc = st.columns(len(w_shop))
            for i, w in enumerate(w_shop):
                with wc[i]:
                    st.write(f"**{w['name']}**")
                    st.caption(f"공격력 +{w['atk']}")
                    if st.button(f"구매 💰{w['price']}G", key=f"buy_w_{i}"):
                        if st.session_state.r_gold >= w['price']:
                            st.session_state.r_gold -= w['price']
                            st.session_state.r_w_name = w['name']
                            st.session_state.r_w_atk = w['atk']
                            st.session_state.r_w_enhance = 0 # 새 무기 장착 시 강화도 초기화
                            st.session_state.r_log.insert(0, f"🛒 무기를 [{w['name']}]으로 전면 교체 장착했습니다.")
                            save_rpg()
                            st.rerun()
                        else: st.error("소지 골드가 부족합니다.")
                        
        with a_tab:
            ac = st.columns(len(a_shop))
            for i, a in enumerate(a_shop):
                with ac[i]:
                    st.write(f"**{a['name']}**")
                    st.caption(f"방어력 +{a['def']}")
                    if st.button(f"구매 💰{a['price']}G", key=f"buy_a_{i}"):
                        if st.session_state.r_gold >= a['price']:
                            st.session_state.r_gold -= a['price']
                            st.session_state.r_a_name = a['name']
                            st.session_state.r_a_def = a['def']
                            st.session_state.r_a_enhance = 0 # 새 방어구 장착 시 강화도 초기화
                            st.session_state.r_log.insert(0, f"🛒 방어구를 [{a['name']}]으로 전면 교체 착용했습니다.")
                            save_rpg()
                            st.rerun()
                        else: st.error("소지 골드가 부족합니다.")

        # [🔥 신규 핵심 기능] 장비 주문서 골드 강화 시스템 단락
        with enh_tab:
            st.write("### 💎 축복받은 장비 인챈트 제단")
            st.write("보유하고 있는 주무기와 방어구에 골드를 헌사하여 추가 한계 강화를 진행합니다.")
            st.warning("⚠️ 주의: 새 장비를 구매하면 기존 장비의 주문서 강화 수치는 사라지고 계승되지 않습니다!")
            
            # 강화 비용 공식: (현재강화레벨 + 1) * 200 골드 균형 패치
            w_cost = (st.session_state.r_w_enhance + 1) * 200
            a_cost = (st.session_state.r_a_enhance + 1) * 200
            
            ec1, ec2 = st.columns(2)
            with ec1:
                st.write(f"#### 무기 강화: (+{st.session_state.r_w_enhance}) ➔ (+{st.session_state.r_w_enhance+1})")
                st.caption(f"강화 보너스 효과: 총 공격력 **+8 추가 상승**")
                if st.button(f"⚔️ 무기 강화하기 (💰 {w_cost} G)", use_container_width=True):
                    if st.session_state.r_gold >= w_cost:
                        st.session_state.r_gold -= w_cost
                        # 85% 확률 성공 시스템 탑재 (실패해도 무기가 부서지지는 않고 골드만 소모되어 안전)
                        if random.random() < 0.85:
                            st.session_state.r_w_enhance += 1
                            st.session_state.r_log.insert(0, f"✨ [강화 대성공] 무기가 더욱 날카로워져 (+{st.session_state.r_w_enhance})강 상태가 되었습니다!")
                        else:
                            st.session_state.r_log.insert(0, f"❌ [강화 실패] 제단의 기류가 불안정하여 강화에 실패했습니다. (장비 손상 없음)")
                        save_rpg()
                        st.rerun()
                    else: st.error("강화 비용 골드가 모자랍니다.")

            with ec2:
                st.write(f"#### 방어구 강화: (+{st.session_state.r_a_enhance}) ➔ (+{st.session_state.r_a_enhance+1})")
                st.caption(f"강화 보너스 효과: 총 방어력 **+5 추가 상승**")
                if st.button(f"🛡️ 방어구 강화하기 (💰 {a_cost} G)", use_container_width=True):
                    if st.session_state.r_gold >= a_cost:
                        st.session_state.r_gold -= a_cost
                        if random.random() < 0.85:
                            st.session_state.r_a_enhance += 1
                            st.session_state.r_log.insert(0, f"✨ [강화 대성공] 방어구가 강화되어 (+{st.session_state.r_a_enhance})강 코팅이 완료되었습니다!")
                        else:
                            st.session_state.r_log.insert(0, f"❌ [강화 실패] 제단의 충격 완화에 실패하여 강화도가 유지되었습니다.")
                        save_rpg()
                        st.rerun()
                    else: st.error("강화 비용 골드가 모자랍니다.")

        st.divider()
        if st.button("💖 성수 엘릭서 캔 드링크 (전체 회복) | 💰 20 G"):
            if st.session_state.r_gold >= 20:
                if st.session_state.r_hp == st.session_state.r_max_hp:
                    st.warning("이미 활력이 가득 차 있어 복용이 불가능합니다.")
                else:
                    st.session_state.r_gold -= 20
                    st.session_state.r_hp = st.session_state.r_max_hp
                    st.session_state.r_log.insert(0, "🧪 엘릭서 수액을 마시고 컨디션을 완전히 충전했습니다.")
                    save_rpg()
                    st.rerun()
            else: st.error("골드가 부족합니다.")

    # ------------------------------------------
    # Tab 3: 스킬 구매 및 동적 장착/해제 세팅실
    # ------------------------------------------
    with tab3:
        st.subheader("📜 영웅 무공 비급 구매소")
        st.write("새로운 고위 마법 및 물리 연격 기술들을 구매해 도서관에 보관하세요.")
        
        sc = st.columns(len(ALL_SKILLS))
        for idx, (s_name, s_info) in enumerate(ALL_SKILLS.items()):
            with sc[idx]:
                st.write(f"**{s_name}**")
                st.caption(s_info["desc"])
                st.caption(f"쿨타임: {s_info['cd']}턴")
                
                if s_name in st.session_state.r_skills_owned:
                    st.success("보유 중")
                else:
                    if st.button(f"배우기 💰{s_info['price']}G", key=f"learn_{idx}"):
                        if st.session_state.r_gold >= s_info["price"]:
                            st.session_state.r_gold -= s_info["price"]
                            st.session_state.r_skills_owned.append(s_name)
                            st.session_state.r_log.insert(0, f"📜 비급서 무공 고찰 완료! [{s_name}]을 습득했습니다.")
                            save_rpg()
                            st.rerun()
                        else: st.error("골드가 부족하여 비급을 구매하지 못했습니다.")

        st.divider()
        st.subheader("🛡️ 실시간 전투 무기 커스텀 세팅 (스킬 장착실)")
        st.write("보유한 비급 목록 중 **최대 2개**를 선택하여 전투 퀵슬롯에 직접 세팅할 수 있습니다.")
        
        if not st.session_state.r_skills_owned:
            st.info("아직 습득한 스킬이 존재하지 않습니다. 상단에서 스킬을 먼저 연마해보세요!")
        else:
            st.write(f"현재 장착 완료된 스킬 덱: `{st.session_state.r_skills_equipped}`")
            
            manage_cols = st.columns(len(st.session_state.r_skills_owned))
            for idx, owned_s in enumerate(st.session_state.r_skills_owned):
                with manage_cols[idx]:
                    st.write(f"**{owned_s}**")
                    
                    if owned_s in st.session_state.r_skills_equipped:
                        if st.button("❌ 장착 해제", key=f"unequip_{idx}", use_container_width=True):
                            st.session_state.r_skills_equipped.remove(owned_s)
                            st.session_state.r_log.insert(0, f"⚙️ 전투 슬롯에서 [{owned_s}]을(를) 탈거했습니다.")
                            save_rpg()
                            st.rerun()
                    else:
                        # 2개 꽉 찬 경우 버튼 비활성화 조치
                        slot_full = len(st.session_state.r_skills_equipped) >= 2
                        if st.button("➕ 스킬 장착", key=f"equip_{idx}", disabled=slot_full, use_container_width=True):
                            st.session_state.r_skills_equipped.append(owned_s)
                            st.session_state.r_log.insert(0, f"⚙️ 전투 슬롯 퀵창에 [{owned_s}]을(를) 커스텀 빌드했습니다.")
                            save_rpg()
                            st.rerun()

    # ------------------------------------------
    # Tab 4: 파일 시스템 백업 아카이빙 세션
    # ------------------------------------------
    with tab4:
        st.write("### 💾 영웅 모험 기록 데이터베이스 파일 입출력")
        sm1, sm2 = st.columns(2)
        if sm1.button("💾 데이터 수동 저장하기 (Save)"):
            save_rpg()
            st.success("강화 수치와 보유 및 장착 스킬 테이블이 안전하게 파일 인코딩 저장되었습니다.")
        if sm2.button("📂 데이터 원격 불러오기 (Load)"):
            if load_rpg():
                st.success("모험의 서 세이브 패키지를 전방위 로드하는 데 성공했습니다!")
                st.rerun()
            else: st.error("매칭되는 백업 세이브 데이터 파일(.json)이 식별되지 않습니다.")

    st.divider()
    st.write("### 📜 전투 상황실 하이라이트 배틀로그")
    for log in st.session_state.r_log[:5]:
        st.write(log)


# ==========================================
# 6.4. 9속성 타워 디펜스 (React 임베드) — (구)RPG 페이지 대체
# ==========================================
TOWER_DEFENSE_HTML = r'''<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<script src="https://cdn.tailwindcss.com"></script>
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script>
  Babel.registerPreset('classic-react', { presets: [[Babel.availablePresets['react'], { runtime: 'classic' }]] });
</script>
<style>
  html,body{margin:0;padding:0;background:#070b16;overflow-x:hidden;font-family:ui-sans-serif,system-ui,'Segoe UI',sans-serif;}
  #root{min-height:100vh;}
  .glass{background:rgba(17,24,39,.55);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.09);}
  .fadein{animation:fadein .35s ease;}
  @keyframes fadein{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  .pop{animation:pop .3s cubic-bezier(.2,1.4,.4,1);}
  @keyframes pop{from{transform:scale(.7);opacity:0}to{transform:scale(1);opacity:1}}
  canvas{display:block;border-radius:14px;touch-action:none;}
  .btng{transition:transform .12s, box-shadow .12s, filter .12s;}
  .btng:hover{transform:translateY(-2px);filter:brightness(1.12);}
  .btng:active{transform:translateY(0);}
  ::-webkit-scrollbar{height:8px;width:8px}::-webkit-scrollbar-thumb{background:#334155;border-radius:8px}
  .sheen{background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.16) 50%,transparent 70%);background-size:200% 100%;animation:sheen 2.6s linear infinite;}
  @keyframes sheen{from{background-position:200% 0}to{background-position:-200% 0}}
  .pulse-red{animation:pr 1s ease-in-out infinite;}
  @keyframes pr{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.5)}50%{box-shadow:0 0 0 6px rgba(239,68,68,0)}}
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel" data-presets="classic-react">
const { useState, useRef, useEffect, useCallback } = React;

/* ===================== 코어 상수 ===================== */
const COLS=12, ROWS=12, CELL=48, SIZE=COLS*CELL;
const VICTORY_WAVE=20;
const ELE = {
  fire:   { name:"불",   emoji:"🔥", color:"#ef4444", glow:"#fca5a5" },
  water:  { name:"물",   emoji:"💧", color:"#3b82f6", glow:"#93c5fd" },
  forest: { name:"숲",   emoji:"🌿", color:"#22c55e", glow:"#86efac" },
  metal:  { name:"금속", emoji:"⚙️", color:"#9ca3af", glow:"#e5e7eb" },
  wind:   { name:"바람", emoji:"🌪️", color:"#38bdf8", glow:"#bae6fd" },
  void:   { name:"공허", emoji:"🌌", color:"#a855f7", glow:"#d8b4fe" },
  holy:   { name:"신성", emoji:"✨", color:"#eab308", glow:"#fde68a" },
  ancient:{ name:"고대", emoji:"🏛️", color:"#b45309", glow:"#fcd34d" },
  earth:  { name:"대지", emoji:"🪨", color:"#92400e", glow:"#d6a878" },
};
const EKEYS = Object.keys(ELE);
const ADV = {
  fire:{forest:1.5,metal:1.5,water:0.5},
  water:{fire:1.5,earth:1.5,forest:0.5},
  forest:{earth:1.5,water:1.5,fire:0.5},
  metal:{}, wind:{}, earth:{},
  void:{holy:2.0}, holy:{void:2.0}, ancient:{},
};
function advMul(tEl,eEl){ const m=ADV[tEl]; return (m && m[eEl])!=null ? m[eEl] : 1; }

/* 타워 정의 + 고유 스킬 */
const TOWER = {
  fire:   { cost:50,  dmg:11, range:2.3, rate:1.3, splash:0,   role:"지속딜", name:"화염탑",
            skill:"화상", skillDesc:"명중 시 3초간 불태워 지속 피해(공격력 35%/초)를 입힌다." },
  water:  { cost:50,  dmg:12, range:2.3, rate:1.2, splash:0,   role:"제어",   name:"해류탑",
            skill:"빙결둔화", skillDesc:"명중 시 1.6초간 이동속도를 40% 늦춘다." },
  forest: { cost:55,  dmg:11, range:2.4, rate:1.25,splash:0,   role:"속박",   name:"숲결탑",
            skill:"뿌리속박", skillDesc:"18% 확률로 넝쿨이 적을 0.8초간 묶어 정지시킨다. (보스 면역)" },
  wind:   { cost:60,  dmg:6,  range:2.2, rate:3.1, splash:0,   role:"연사",   name:"질풍탑",
            skill:"돌풍넉백", skillDesc:"명중한 적을 길 뒤쪽으로 밀쳐낸다. (탱커/보스는 저항)" },
  earth:  { cost:70,  dmg:14, range:2.1, rate:0.9, splash:1.15,role:"광역",   name:"대지탑",
            skill:"지진스턴", skillDesc:"광역 피해 + 15% 확률로 0.5초 기절시킨다. (보스 면역)" },
  metal:  { cost:70,  dmg:30, range:3.3, rate:0.6, splash:0,   role:"저격",   name:"강철포",
            skill:"관통탄", skillDesc:"탄환이 적을 꿰뚫고 뒤의 적들에게 70% 피해를 추가로 입힌다." },
  void:   { cost:80,  dmg:16, range:2.6, rate:1.1, splash:0,   role:"처형",   name:"공허탑",
            skill:"공허처형", skillDesc:"HP 12% 이하의 적을 즉시 소멸시킨다. (보스 제외)" },
  holy:   { cost:80,  dmg:15, range:3.0, rate:1.1, splash:0,   role:"강타",   name:"성광탑",
            skill:"천벌강타", skillDesc:"매 5번째 공격이 빛기둥과 함께 3배 피해로 적중한다." },
  ancient:{ cost:150, dmg:34, range:3.4, rate:1.05,splash:0,   role:"각인",   name:"고대탑",
            skill:"룬각인", skillDesc:"명중한 적에게 4초간 룬을 새겨 모든 타워의 피해를 25% 증폭시킨다." },
};
const MAX_LV=6;
function towerStat(el, lvl){
  const b=TOWER[el];
  return { dmg: b.dmg*Math.pow(1.55,lvl-1), range: b.range+(lvl-1)*0.22, rate: b.rate*Math.pow(1.09,lvl-1), splash: b.splash };
}
function upgradeCost(el, lvl){ return Math.round(TOWER[el].cost*(0.85+lvl*0.55)); }

/* ===== 경로 ===== */
const WP = [[-1,1],[10,1],[10,3],[1,3],[1,5],[10,5],[10,7],[1,7],[1,9],[12,9]];
const clampC=v=>Math.max(0,Math.min(COLS-1,v));
const PATH=new Set();
(()=>{ for(let i=0;i<WP.length-1;i++){
  let c1=clampC(WP[i][0]), r1=clampC(WP[i][1]), c2=clampC(WP[i+1][0]), r2=clampC(WP[i+1][1]);
  const dc=Math.sign(c2-c1), dr=Math.sign(r2-r1); let c=c1,r=r1; PATH.add(c+","+r);
  while(c!==c2||r!==r2){ if(c!==c2)c+=dc; else if(r!==r2)r+=dr; PATH.add(c+","+r); }
} })();
function isPath(c,r){ return PATH.has(c+","+r); }
const cellPx=(c,r)=>({x:c*CELL+CELL/2, y:r*CELL+CELL/2});
const SEG=[]; let TOTAL=0;
(()=>{ for(let i=0;i<WP.length-1;i++){
  const a=cellPx(WP[i][0],WP[i][1]), b=cellPx(WP[i+1][0],WP[i+1][1]);
  const len=Math.hypot(b.x-a.x,b.y-a.y);
  SEG.push({x1:a.x,y1:a.y,x2:b.x,y2:b.y,len,cum:TOTAL}); TOTAL+=len;
} })();
function posAt(dist){
  if(dist<=0) return {x:SEG[0].x1,y:SEG[0].y1,ang:0};
  for(const s of SEG){ if(dist<=s.cum+s.len){ const t=(dist-s.cum)/s.len;
    return {x:s.x1+(s.x2-s.x1)*t, y:s.y1+(s.y2-s.y1)*t, ang:Math.atan2(s.y2-s.y1,s.x2-s.x1)}; } }
  const l=SEG[SEG.length-1]; return {x:l.x2,y:l.y2,ang:0};
}
const pick=a=>a[Math.floor(Math.random()*a.length)];
const rand=(a,b)=>a+Math.random()*(b-a);

/* 웨이브 구성 생성 (미리 만들어 예고에 사용) */
function genWave(w){
  const q=[]; const count=7+Math.floor(w*2.3);
  const primary=EKEYS[(w-1)%9];
  const gap=Math.max(210, 560-w*15);
  for(let i=0;i<count;i++){
    let kind="normal"; const rr=Math.random();
    if(w>=3 && rr<0.18) kind="fast"; else if(w>=4 && rr<0.32) kind="tank";
    const el = Math.random()<0.6 ? primary : pick(EKEYS);
    q.push({el,kind,at:i*gap});
  }
  if(w%5===0) q.push({el:primary,kind:"boss",at:count*gap+800});
  return {q, primary};
}

/* ===================== 저장(이어하기) ===================== */
// 웨이브 사이(건설 페이즈)에만 저장한다 — 적/투사체가 날아다니는 중간 상태는 저장하지 않아 항상 안전하게 복원 가능.
const TD_SAVE_KEY = "ynd_td_save_v1";
function readTdSave(){
  try{ const raw=localStorage.getItem(TD_SAVE_KEY); if(!raw) return null;
    const obj=JSON.parse(raw);
    if(obj && Array.isArray(obj.towers) && obj.hp>0) return obj;
  }catch(e){}
  return null;
}
function writeTdSave(obj){ try{ localStorage.setItem(TD_SAVE_KEY, JSON.stringify(obj)); }catch(e){} }
function clearTdSave(){ try{ localStorage.removeItem(TD_SAVE_KEY); }catch(e){} }

/* ===================== 게임 ===================== */
function Game(){
  const canvasRef=useRef(null);
  const [initSave] = useState(()=>readTdSave());
  const enemies=useRef([]), shots=useRef([]), parts=useRef([]), floats=useRef([]);
  const towers=useRef(initSave ? initSave.towers.map(t=>{ const p=cellPx(t.c,t.r);
    return {id:t.id, el:t.el, c:t.c, r:t.r, x:p.x, y:p.y, lvl:t.lvl, invested:t.invested, cd:0, ang:0, recoil:0, smite:0}; }) : []);
  const hp=useRef(initSave?initSave.hp:20), gold=useRef(initSave?initSave.gold:180);
  const wave=useRef(initSave?initSave.wave:0), kills=useRef(initSave?initSave.kills:0);
  const phase=useRef("build"); // build|wave|over|victory
  const endless=useRef(initSave?!!initSave.endless:false);
  const paused=useRef(false), speed=useRef(1), auto=useRef(false);
  const queue=useRef([]), qIdx=useRef(0), waveClock=useRef(0);
  const nextWaveRef=useRef(genWave((initSave?initSave.wave:0)+1));
  const shake=useRef({t:0,mag:0});
  const idc=useRef(initSave&&initSave.towers.length ? Math.max(...initSave.towers.map(t=>t.id||0))+1 : 1);
  const uiRef=useRef({build:null,sel:null,hover:null});
  const bgRef=useRef(null);
  const acc=useRef(0);
  const best=useRef(parseInt(localStorage.getItem("ynd_td_best")||"0",10));

  const [ui,setUi]=useState({hp:initSave?initSave.hp:20,gold:initSave?initSave.gold:180,wave:initSave?initSave.wave:0,kills:initSave?initSave.kills:0,best:best.current});
  const [loadedMsg,setLoadedMsg]=useState(initSave?"💾 저장된 게임을 불러왔어요!":null);
  const [phaseS,setPhaseS]=useState("build");
  const [build,setBuild]=useState(null);
  const [selId,setSelId]=useState(null);
  const [tick,setTick]=useState(0);
  const [spd,setSpd]=useState(1);
  const [aut,setAut]=useState(false);
  const [result,setResult]=useState(null);   // 게임오버
  const [victory,setVictory]=useState(false);
  const [preview,setPreview]=useState(null);
  const [noGold,setNoGold]=useState(false);
  const [confirmNew,setConfirmNew]=useState(false);

  const syncUi=useCallback(()=>{ setUi({hp:hp.current,gold:gold.current,wave:wave.current,kills:kills.current,best:best.current}); },[]);
  const updPreview=useCallback(()=>{
    const nw=nextWaveRef.current; const cnt={normal:0,fast:0,tank:0,boss:0};
    nw.q.forEach(s=>cnt[s.kind]++);
    setPreview({primary:nw.primary, cnt, total:nw.q.length});
  },[]);
  useEffect(()=>{ updPreview(); },[]);
  useEffect(()=>{ if(loadedMsg){ const t=setTimeout(()=>setLoadedMsg(null),2400); return ()=>clearTimeout(t); } },[loadedMsg]);

  // 건설 페이즈(웨이브 사이)에만 저장 — 전투 중간 상태는 저장하지 않는다.
  function saveGame(){
    if(phase.current!=="build") return;
    writeTdSave({
      hp:hp.current, gold:gold.current, wave:wave.current, kills:kills.current, endless:endless.current,
      towers: towers.current.map(t=>({id:t.id, el:t.el, c:t.c, r:t.r, lvl:t.lvl, invested:t.invested})),
    });
  }

  /* ---------- 배경 캐시 ---------- */
  const buildBg=useCallback(()=>{
    const bg=document.createElement("canvas"); bg.width=SIZE; bg.height=SIZE;
    const g=bg.getContext("2d");
    const grad=g.createLinearGradient(0,0,SIZE,SIZE);
    grad.addColorStop(0,"#0b1226"); grad.addColorStop(.5,"#0a1020"); grad.addColorStop(1,"#0d0a1c");
    g.fillStyle=grad; g.fillRect(0,0,SIZE,SIZE);
    // 은은한 성운
    for(let i=0;i<26;i++){ const x=Math.random()*SIZE,y=Math.random()*SIZE,r=rand(30,90);
      const rg=g.createRadialGradient(x,y,0,x,y,r);
      rg.addColorStop(0,"rgba(99,102,241,.045)"); rg.addColorStop(1,"transparent");
      g.fillStyle=rg; g.fillRect(x-r,y-r,r*2,r*2); }
    // 별
    for(let i=0;i<70;i++){ g.fillStyle="rgba(255,255,255,"+rand(.04,.16)+")";
      g.fillRect(Math.random()*SIZE, Math.random()*SIZE, 1.4, 1.4); }
    // 건설 타일
    for(let c=0;c<COLS;c++)for(let r=0;r<ROWS;r++){
      if(isPath(c,r))continue; const x=c*CELL,y=r*CELL;
      g.fillStyle="rgba(56,80,140,.10)"; roundRect(g,x+3,y+3,CELL-6,CELL-6,7); g.fill();
      g.strokeStyle="rgba(120,150,220,.10)"; g.lineWidth=1; g.stroke();
    }
    // 길
    g.lineCap="round"; g.lineJoin="round";
    g.strokeStyle="rgba(80,60,140,.32)"; g.lineWidth=CELL-4; pathStroke(g);
    g.strokeStyle="#241a3a"; g.lineWidth=CELL-14; pathStroke(g);
    // 길 가장자리 라이트
    g.strokeStyle="rgba(150,110,255,.22)"; g.lineWidth=CELL-12; g.setLineDash([2,16]); pathStroke(g); g.setLineDash([]);
    bgRef.current=bg;
  },[]);
  function pathStroke(g){ g.beginPath(); const p0=cellPx(clampC(WP[0][0]),clampC(WP[0][1])); g.moveTo(p0.x,p0.y);
    for(let i=1;i<WP.length;i++){ const p=cellPx(clampC(WP[i][0]),clampC(WP[i][1])); g.lineTo(p.x,p.y);} g.stroke(); }

  /* ---------- 웨이브 ---------- */
  function startWave(){
    if(phase.current!=="build") return;
    wave.current++; queue.current=nextWaveRef.current.q; qIdx.current=0; waveClock.current=0;
    nextWaveRef.current=genWave(wave.current+1); updPreview();
    phase.current="wave"; setPhaseS("wave"); syncUi();
  }
  function makeEnemy(spec){
    const w=wave.current; const base=16*Math.pow(1.34,w-1);
    let ehp=base, sp=50*(1+w*0.014), size=13;
    if(spec.kind==="fast"){ ehp*=0.55; sp*=1.7; size=11; }
    if(spec.kind==="tank"){ ehp*=3.4; sp*=0.68; size=18; }
    if(spec.kind==="boss"){ ehp*=18;  sp*=0.5;  size=27; }
    ehp=Math.round(ehp);
    const reward=spec.kind==="boss"?Math.round(ehp*0.016)+100:Math.max(3,Math.round(ehp*0.05)+2);
    return { id:idc.current++, el:spec.el, kind:spec.kind, dist:-rand(0,10), hp:ehp, maxHp:ehp, sp, size,
      flash:0, reward, dead:false, burn:0, burnDps:0, burnAcc:0, slow:0, root:0, stun:0, mark:0, kbCd:0 };
  }

  /* ---------- 파티클 ---------- */
  function burst(x,y,color,n,pow){ for(let i=0;i<n;i++){ const a=Math.random()*7,s=rand(.4,1)*(pow||70);
    parts.current.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:0,max:rand(.28,.55),size:rand(2,4.5),color}); } }
  function ringFx(x,y,color,r0,r1,dur){ parts.current.push({ring:true,x,y,r0,r1,life:0,max:dur||.4,color}); }
  function pillarFx(x,y,color){ parts.current.push({pillar:true,x,y,life:0,max:.45,color}); }
  function floatTxt(x,y,val,opts){ floats.current.push(Object.assign({x:x+rand(-6,6),y,vy:-46,life:0,max:.8,val,crit:false,color:"#f1f5f9"},opts||{})); }

  /* ---------- 발사/피해 ---------- */
  function fire(t){
    const st=towerStat(t.el,t.lvl), rangePx=st.range*CELL;
    let best=null,bestD=-1;
    for(const e of enemies.current){ if(e.dead)continue; const p=posAt(e.dist);
      const d=Math.hypot(p.x-t.x,p.y-t.y); if(d<=rangePx && e.dist>bestD){ bestD=e.dist; best=e; best._p=p; } }
    if(!best) return;
    t.ang=Math.atan2(best._p.y-t.y,best._p.x-t.x); t.recoil=1;
    burst(t.x+Math.cos(t.ang)*16,t.y+Math.sin(t.ang)*16,ELE[t.el].glow,4,40);
    let smite=false;
    if(t.el==="holy"){ t.smite=(t.smite||0)+1; if(t.smite>=5){ t.smite=0; smite=true; } }
    shots.current.push({ id:idc.current++, el:t.el, x:t.x, y:t.y, ox:t.x, oy:t.y, tid:best.id,
      dmg:st.dmg*(smite?3:1), smite, splash:st.splash, sp:t.el==="wind"?560:t.el==="metal"?760:440, trail:[] });
    t.cd=1000/st.rate;
  }
  function kill(e,px,py){
    if(e.dead)return; e.dead=true; kills.current++;
    gold.current+=e.reward;
    floatTxt(px,py-4,"+"+e.reward+"G",{color:"#fde047",max:.9});
    burst(px,py,ELE[e.el].color,e.kind==="boss"?42:16,e.kind==="boss"?200:120);
    ringFx(px,py,ELE[e.el].glow,e.size,e.size*2.6,.4);
    if(e.kind==="boss") shake.current={t:340,mag:9};
  }
  function damage(e,amount,px,py,showOpts){
    e.hp-=amount;
    if(showOpts!==false) {}
    if(e.hp<=0) kill(e,px,py);
  }
  function dealHit(shot,e,px,py){
    let mul=advMul(shot.el,e.el);
    if(e.mark>0) mul*=1.25;
    const dmg=shot.dmg*mul;
    e.flash=1;
    const crit=mul>=1.5||shot.smite;
    floatTxt(px,py-e.size-6,Math.round(dmg),{crit,max:crit?1:.75,color:mul<1?"#94a3b8":crit?"#fde047":"#f1f5f9",label:shot.smite?"SMITE!":(mul>=1.5?"CRITICAL!":null)});
    burst(px,py,ELE[shot.el].glow,crit?14:8,crit?120:80);
    if(crit) shake.current={t:170,mag:shot.smite?6:(mul>=2?7:5)};
    if(shot.smite) pillarFx(px,py,"#fde047");
    /* --- 타워 고유 스킬 --- */
    if(shot.el==="fire"){ e.burn=3; e.burnDps=shot.dmg*0.35; }
    else if(shot.el==="water"){ e.slow=1.6; }
    else if(shot.el==="forest"){ if(e.kind!=="boss"&&Math.random()<0.18){ e.root=e.kind==="tank"?0.4:0.8;
      ringFx(px,py,"#22c55e",6,e.size+10,.35); floatTxt(px,py-e.size-16,"속박!",{color:"#4ade80",max:.6}); } }
    else if(shot.el==="wind"){ if(e.kbCd<=0){ const kb=e.kind==="boss"?4:e.kind==="tank"?10:26;
      e.dist=Math.max(0,e.dist-kb); e.kbCd=0.4; } }
    else if(shot.el==="void"){ if(e.kind!=="boss"&&e.hp>0&&(e.hp-dmg)/e.maxHp<0.12){
      damage(e,e.hp,px,py); ringFx(px,py,"#a855f7",4,e.size*2.4,.45);
      floatTxt(px,py-e.size-16,"처형!",{color:"#d8b4fe",crit:true,max:.9});
      damage(e,dmg,px,py); return; } }
    else if(shot.el==="ancient"){ e.mark=4; }
    damage(e,dmg,px,py);
    /* 금속 관통: 진행 방향 뒤 corridor 적중 */
    if(shot.el==="metal"){
      const dirx=px-shot.ox, diry=py-shot.oy, dl=Math.hypot(dirx,diry)||1;
      const ux=dirx/dl, uy=diry/dl;
      for(const o of enemies.current){ if(o.dead||o===e)continue; const op=posAt(o.dist);
        const relx=op.x-px, rely=op.y-py; const along=relx*ux+rely*uy;
        if(along>0&&along<110){ const perp=Math.abs(relx*-uy+rely*ux);
          if(perp<=16){ const m2=advMul(shot.el,o.el)*(o.mark>0?1.25:1); const d2=shot.dmg*0.7*m2;
            o.flash=1; floatTxt(op.x,op.y-o.size-4,Math.round(d2),{color:"#e5e7eb",max:.6}); damage(o,d2,op.x,op.y); } } }
      // 관통 궤적 시각화
      parts.current.push({beam:true,x:px,y:py,x2:px+ux*110,y2:py+uy*110,life:0,max:.22,color:"#e5e7eb"});
    }
    /* 대지 광역 + 스턴 */
    if(shot.splash>0){ const rad=shot.splash*CELL;
      ringFx(px,py,ELE[shot.el].glow,8,rad,.35);
      for(const o of enemies.current){ if(o.dead||o===e)continue; const op=posAt(o.dist);
        if(Math.hypot(op.x-px,op.y-py)<=rad){ const m2=advMul(shot.el,o.el)*(o.mark>0?1.25:1);
          const d2=shot.dmg*0.5*m2; o.flash=1;
          floatTxt(op.x,op.y-o.size-4,Math.round(d2),{color:"#fbbf24",max:.6}); damage(o,d2,op.x,op.y);
          if(shot.el==="earth"&&o.kind!=="boss"&&Math.random()<0.15){ o.stun=0.5; floatTxt(op.x,op.y-o.size-14,"기절!",{color:"#fcd34d",max:.6}); } } }
      if(shot.el==="earth"&&e.kind!=="boss"&&Math.random()<0.15&&!e.dead){ e.stun=0.5; floatTxt(px,py-e.size-14,"기절!",{color:"#fcd34d",max:.6}); }
    }
  }

  /* ---------- 스텝 ---------- */
  function step(dtMs){
    if(phase.current==="over") return;
    const dt=dtMs/1000;
    if(phase.current==="wave"){ waveClock.current+=dtMs;
      while(qIdx.current<queue.current.length && queue.current[qIdx.current].at<=waveClock.current){
        enemies.current.push(makeEnemy(queue.current[qIdx.current])); qIdx.current++; } }
    let reached=0;
    for(const e of enemies.current){ if(e.dead)continue;
      // 상태이상 타이머
      if(e.slow>0)e.slow-=dt; if(e.root>0)e.root-=dt; if(e.stun>0)e.stun-=dt;
      if(e.mark>0)e.mark-=dt; if(e.kbCd>0)e.kbCd-=dt;
      if(e.burn>0){ e.burn-=dt; const bd=e.burnDps*dt; e.hp-=bd; e.burnAcc+=bd;
        if(e.burnAcc>=e.burnDps*0.55){ const p=posAt(e.dist);
          floatTxt(p.x,p.y-e.size-4,Math.round(e.burnAcc),{color:"#fb923c",max:.55}); e.burnAcc=0; }
        if(e.hp<=0){ const p=posAt(e.dist); kill(e,p.x,p.y); continue; } }
      const spMul=(e.slow>0?0.6:1)*((e.root>0||e.stun>0)?0:1);
      e.dist+=e.sp*spMul*dt;
      if(e.flash>0)e.flash=Math.max(0,e.flash-dt*4);
      if(e.dist>=TOTAL){ e.dead=true; reached++; }
    }
    if(reached>0){ hp.current=Math.max(0,hp.current-reached); shake.current={t:220,mag:6};
      if(hp.current<=0){ phase.current="over"; setPhaseS("over"); clearTdSave();
        if(wave.current>best.current){ best.current=wave.current; try{localStorage.setItem("ynd_td_best",String(best.current));}catch(_){} }
        setResult({wave:wave.current,kills:kills.current,best:best.current}); } }
    for(const t of towers.current){ t.cd-=dtMs; if(t.recoil>0)t.recoil=Math.max(0,t.recoil-dt*6); if(t.cd<=0)fire(t); }
    for(const s of shots.current){ if(s.done)continue;
      const e=enemies.current.find(x=>x.id===s.tid&&!x.dead); let tx,ty;
      if(e){ const p=posAt(e.dist); tx=p.x; ty=p.y; s.lx=tx; s.ly=ty; } else { tx=s.lx; ty=s.ly; if(tx==null){s.done=true;continue;} }
      const dx=tx-s.x,dy=ty-s.y,d=Math.hypot(dx,dy),move=s.sp*dt;
      s.trail.push({x:s.x,y:s.y}); if(s.trail.length>6)s.trail.shift();
      if(d<=move+(e?e.size:6)){ if(e)dealHit(s,e,tx,ty); else burst(tx,ty,ELE[s.el].glow,6,70); s.done=true; }
      else { s.x+=dx/d*move; s.y+=dy/d*move; }
    }
    enemies.current=enemies.current.filter(e=>!e.dead);
    shots.current=shots.current.filter(s=>!s.done);
    for(const p of parts.current){ p.life+=dt; if(!p.ring&&!p.beam&&!p.pillar){ p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=180*dt; p.vx*=0.94; } }
    parts.current=parts.current.filter(p=>p.life<p.max);
    for(const f of floats.current){ f.life+=dt; f.y+=f.vy*dt; f.vy+=52*dt; }
    floats.current=floats.current.filter(f=>f.life<f.max);
    if(shake.current.t>0)shake.current.t-=dtMs;
    if(phase.current==="wave" && qIdx.current>=queue.current.length && enemies.current.length===0){
      const bonus=18+wave.current*6+Math.min(50,Math.floor(gold.current*0.05));
      gold.current+=bonus;
      phase.current="build"; setPhaseS("build"); syncUi(); saveGame();
      if(!endless.current && wave.current>=VICTORY_WAVE){
        phase.current="victory"; setPhaseS("victory"); clearTdSave();
        if(wave.current>best.current){ best.current=wave.current; try{localStorage.setItem("ynd_td_best",String(best.current));}catch(_){} }
        setVictory(true); return; }
      if(auto.current) setTimeout(()=>{ if(phase.current==="build") startWave(); },700);
    }
    acc.current+=dtMs; if(acc.current>=110){ acc.current=0; syncUi(); }
  }

  /* ---------- 렌더 ---------- */
  function draw(now){
    const cv=canvasRef.current; if(!cv)return; const ctx=cv.getContext("2d");
    const DPR=cv._dpr||1;
    ctx.setTransform(DPR,0,0,DPR,0,0); ctx.clearRect(0,0,SIZE,SIZE);
    let sx=0,sy=0; if(shake.current.t>0){ const m=shake.current.mag*(shake.current.t/200); sx=rand(-m,m); sy=rand(-m,m); }
    ctx.save(); ctx.translate(sx,sy);
    if(bgRef.current)ctx.drawImage(bgRef.current,0,0);
    // 흐르는 경로 점선
    ctx.save(); ctx.strokeStyle="rgba(190,160,255,.6)"; ctx.lineWidth=3; ctx.lineCap="round";
    ctx.setLineDash([8,14]); ctx.lineDashOffset=-(now/34)%22; pathStroke(ctx); ctx.restore();
    // IN/OUT 포탈
    portal(ctx,posAt(0),"#22c55e",now); portal(ctx,posAt(TOTAL),"#ef4444",now);
    // 사거리 미리보기
    const u=uiRef.current;
    if(u.sel!=null){ const t=towers.current.find(x=>x.id===u.sel);
      if(t){ rangeCircle(ctx,t.x,t.y,towerStat(t.el,t.lvl).range*CELL,ELE[t.el].glow,now); } }
    else if(u.build&&u.hover){ const [c,r]=u.hover;
      if(c>=0&&c<COLS&&r>=0&&r<ROWS&&!isPath(c,r)){ const x=c*CELL+CELL/2,y=r*CELL+CELL/2;
        const ok=!towers.current.some(t=>t.c===c&&t.r===r)&&gold.current>=TOWER[u.build].cost;
        rangeCircle(ctx,x,y,TOWER[u.build].range*CELL,ok?ELE[u.build].glow:"#ef4444",now);
        drawTower(ctx,{x,y,el:u.build,lvl:1,ang:0,recoil:0},.55,now); } }
    for(const t of towers.current)drawTower(ctx,t,1,now);
    for(const e of enemies.current){ const p=posAt(e.dist); drawEnemy(ctx,p.x,p.y,e,now); }
    for(const s of shots.current)drawShot(ctx,s);
    // 파티클
    for(const p of parts.current){ const a=1-p.life/p.max;
      if(p.ring){ ctx.globalAlpha=a*.9; ctx.strokeStyle=p.color; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r0+(p.r1-p.r0)*(p.life/p.max),0,7); ctx.stroke(); }
      else if(p.beam){ ctx.globalAlpha=a; ctx.strokeStyle=p.color; ctx.lineWidth=3;
        ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x2,p.y2); ctx.stroke(); }
      else if(p.pillar){ ctx.globalAlpha=a*.85; const g2=ctx.createLinearGradient(p.x,0,p.x,p.y);
        g2.addColorStop(0,"rgba(253,224,71,0)"); g2.addColorStop(.6,p.color);
        ctx.fillStyle=g2; ctx.fillRect(p.x-9,0,18,p.y); }
      else { ctx.globalAlpha=a; ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,7); ctx.fill(); } }
    ctx.globalAlpha=1;
    // 플로팅 텍스트
    for(const f of floats.current){ const a=1-f.life/f.max; ctx.globalAlpha=Math.max(0,a);
      ctx.font=(f.crit?"bold 20px":"bold 13px")+" ui-monospace,monospace"; ctx.textAlign="center";
      ctx.lineWidth=3; ctx.strokeStyle="rgba(0,0,0,.6)"; ctx.fillStyle=f.color;
      ctx.strokeText(f.val,f.x,f.y); ctx.fillText(f.val,f.x,f.y);
      if(f.label){ ctx.font="bold 10px sans-serif"; ctx.fillStyle="#fde047"; ctx.fillText(f.label,f.x,f.y-18); } }
    ctx.globalAlpha=1;
    // 보스 HP바
    const boss=enemies.current.find(e=>e.kind==="boss"&&!e.dead);
    if(boss){ const w=SIZE-160, x=80, y=14, r=Math.max(0,boss.hp/boss.maxHp);
      ctx.fillStyle="rgba(0,0,0,.6)"; roundRect(ctx,x,y,w,12,6); ctx.fill();
      const bg2=ctx.createLinearGradient(x,0,x+w,0); bg2.addColorStop(0,"#f43f5e"); bg2.addColorStop(1,"#a855f7");
      ctx.fillStyle=bg2; roundRect(ctx,x,y,w*r,12,6); ctx.fill();
      ctx.strokeStyle="rgba(255,255,255,.35)"; ctx.lineWidth=1; roundRect(ctx,x,y,w,12,6); ctx.stroke();
      ctx.font="bold 11px sans-serif"; ctx.textAlign="center"; ctx.fillStyle="#fff";
      ctx.fillText("👑 웨이브 보스  "+Math.ceil(boss.hp)+" / "+boss.maxHp, SIZE/2, y+10); }
    ctx.restore();
  }
  function portal(ctx,p,col,now){ const r=13+Math.sin(now/300)*2;
    ctx.save(); ctx.shadowColor=col; ctx.shadowBlur=18;
    ctx.strokeStyle=col; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(p.x,p.y,r,0,7); ctx.stroke();
    ctx.globalAlpha=.5; ctx.beginPath(); ctx.arc(p.x,p.y,r*0.55,0,7); ctx.stroke(); ctx.restore(); }
  function rangeCircle(ctx,x,y,rad,col,now){ ctx.save();
    const pr=rad*(1+Math.sin(now/420)*0.012);
    ctx.fillStyle=col+"1e"; ctx.strokeStyle=col+"aa"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(x,y,pr,0,7); ctx.fill(); ctx.stroke(); ctx.restore(); }
  function drawTower(ctx,t,alpha,now){
    const c=ELE[t.el]; ctx.save(); ctx.globalAlpha=alpha; ctx.translate(t.x,t.y);
    ctx.fillStyle="#1e293b"; ctx.strokeStyle=c.color; ctx.lineWidth=2;
    hexPath(ctx,0,0,18); ctx.fill(); ctx.stroke();
    if(t.lvl>=3){ ctx.save(); ctx.rotate(now/900); ctx.strokeStyle=c.glow+"88"; ctx.lineWidth=1.5;
      ctx.setLineDash([5,7]); ctx.beginPath(); ctx.arc(0,0,22,0,7); ctx.stroke(); ctx.restore(); }
    if(t.lvl>=5){ ctx.save(); ctx.rotate(-now/700); ctx.strokeStyle="#fde047aa"; ctx.lineWidth=1.5;
      ctx.setLineDash([3,9]); ctx.beginPath(); ctx.arc(0,0,26,0,7); ctx.stroke(); ctx.restore(); }
    ctx.shadowColor=c.color; ctx.shadowBlur=12;
    hexPath(ctx,0,0,13); ctx.fillStyle=c.color+"cc"; ctx.fill(); ctx.shadowBlur=0;
    const rc=(t.recoil||0)*4;
    ctx.rotate(t.ang||0); ctx.fillStyle="#0f172a"; roundRect(ctx,-3-rc,-4,22,8,3); ctx.fill();
    ctx.fillStyle=c.glow; roundRect(ctx,12-rc,-3,7,6,2); ctx.fill(); ctx.rotate(-(t.ang||0));
    ctx.font="12px sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(c.emoji,0,0);
    for(let i=0;i<t.lvl-1;i++){ ctx.fillStyle="#fde047"; ctx.beginPath(); ctx.arc(-10+i*5,15,1.7,0,7); ctx.fill(); }
    ctx.restore();
  }
  function drawEnemy(ctx,x,y,e,now){
    const c=ELE[e.el]; ctx.save(); ctx.translate(x,y);
    // 룬 각인
    if(e.mark>0){ ctx.save(); ctx.rotate(now/500); ctx.strokeStyle="#fcd34dcc"; ctx.lineWidth=2;
      ctx.setLineDash([4,5]); ctx.beginPath(); ctx.arc(0,0,e.size+7,0,7); ctx.stroke(); ctx.restore(); }
    ctx.fillStyle="rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(0,e.size*0.7,e.size*0.8,e.size*0.32,0,0,7); ctx.fill();
    const grd=ctx.createRadialGradient(-e.size*.3,-e.size*.3,1,0,0,e.size);
    grd.addColorStop(0,c.glow); grd.addColorStop(1,c.color);
    ctx.shadowColor=c.color; ctx.shadowBlur=e.kind==="boss"?20:8;
    ctx.fillStyle=grd;
    if(e.kind==="fast"){ ctx.beginPath(); ctx.moveTo(e.size,0); ctx.lineTo(-e.size*.8,-e.size*.75);
      ctx.lineTo(-e.size*.8,e.size*.75); ctx.closePath(); ctx.fill(); }
    else if(e.kind==="tank"){ roundRect(ctx,-e.size,-e.size,e.size*2,e.size*2,6); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(0,0,e.size,0,7); ctx.fill(); }
    if(e.kind==="boss"){ for(let i=0;i<8;i++){ const a=i*Math.PI/4+now/800;
      ctx.beginPath(); ctx.moveTo(Math.cos(a)*e.size,Math.sin(a)*e.size);
      ctx.lineTo(Math.cos(a)*(e.size+7),Math.sin(a)*(e.size+7));
      ctx.strokeStyle=c.glow; ctx.lineWidth=3; ctx.stroke(); } }
    ctx.shadowBlur=0; ctx.lineWidth=2; ctx.strokeStyle="rgba(0,0,0,.4)";
    if(e.kind==="tank"){ roundRect(ctx,-e.size,-e.size,e.size*2,e.size*2,6); ctx.stroke();
      ctx.strokeStyle="#e2e8f0"; ctx.lineWidth=2.2; ctx.beginPath(); ctx.arc(0,0,e.size+4,-.8,.8); ctx.stroke(); }
    else if(e.kind!=="fast"){ ctx.beginPath(); ctx.arc(0,0,e.size,0,7); ctx.stroke(); }
    if(e.kind==="boss"){ ctx.font="13px sans-serif"; ctx.textAlign="center"; ctx.fillText("👑",0,-e.size-10); }
    // 눈
    ctx.fillStyle="#0b1020"; ctx.beginPath();
    ctx.arc(-e.size*.28,-e.size*.12,e.size*.15,0,7); ctx.arc(e.size*.28,-e.size*.12,e.size*.15,0,7); ctx.fill();
    // 상태 오버레이
    if(e.slow>0){ ctx.globalAlpha=.4; ctx.fillStyle="#60a5fa"; ctx.beginPath(); ctx.arc(0,0,e.size,0,7); ctx.fill(); ctx.globalAlpha=1; }
    if(e.burn>0){ ctx.font="10px sans-serif"; ctx.textAlign="center"; ctx.fillText("🔥",e.size*.6,-e.size*.6); }
    if(e.root>0){ ctx.font="10px sans-serif"; ctx.fillText("🌿",-e.size*.6,-e.size*.6); }
    if(e.stun>0){ ctx.font="10px sans-serif"; ctx.fillText("💫",0,-e.size-16); }
    if(e.flash>0){ ctx.globalAlpha=e.flash*.8; ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(0,0,e.size,0,7); ctx.fill(); ctx.globalAlpha=1; }
    const w=e.size*2.1,hpr=Math.max(0,e.hp/e.maxHp);
    ctx.fillStyle="rgba(0,0,0,.55)"; roundRect(ctx,-w/2,-e.size-9,w,4,2); ctx.fill();
    ctx.fillStyle=hpr>.5?"#22c55e":hpr>.25?"#eab308":"#ef4444"; roundRect(ctx,-w/2,-e.size-9,w*hpr,4,2); ctx.fill();
    ctx.restore();
  }
  function drawShot(ctx,s){ const c=ELE[s.el];
    for(let i=0;i<s.trail.length;i++){ const tp=s.trail[i]; const a=(i+1)/s.trail.length*0.5;
      ctx.globalAlpha=a; ctx.fillStyle=c.glow; ctx.beginPath(); ctx.arc(tp.x,tp.y,2.5*a+1,0,7); ctx.fill(); }
    ctx.globalAlpha=1; ctx.shadowColor=c.color; ctx.shadowBlur=s.smite?20:12; ctx.fillStyle=c.glow;
    ctx.beginPath(); ctx.arc(s.x,s.y,s.smite?7:4.5,0,7); ctx.fill();
    ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(s.x,s.y,s.smite?3:1.8,0,7); ctx.fill(); ctx.shadowBlur=0; }
  function hexPath(ctx,x,y,r){ ctx.beginPath(); for(let i=0;i<6;i++){ const a=i*Math.PI/3-Math.PI/2;
    const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r; i?ctx.lineTo(px,py):ctx.moveTo(px,py);} ctx.closePath(); }

  /* ---------- 루프 ---------- */
  useEffect(()=>{
    const cv=canvasRef.current; const DPR=Math.min(2,window.devicePixelRatio||1);
    cv.width=SIZE*DPR; cv.height=SIZE*DPR; cv.style.width=SIZE+"px"; cv.style.height=SIZE+"px"; cv._dpr=DPR;
    buildBg();
    let raf,last=performance.now();
    const loop=(now)=>{ let dt=now-last; last=now; if(dt>50)dt=50;
      if(!paused.current)step(dt*speed.current); draw(now); raf=requestAnimationFrame(loop); };
    raf=requestAnimationFrame(loop);
    return ()=>cancelAnimationFrame(raf);
  },[]);
  useEffect(()=>{ uiRef.current.build=build; },[build]);
  useEffect(()=>{ uiRef.current.sel=selId; },[selId]);
  useEffect(()=>{ speed.current=spd; },[spd]);
  useEffect(()=>{ auto.current=aut; },[aut]);

  /* ---------- 입력 ---------- */
  function cellFromEvent(ev){ const rc=canvasRef.current.getBoundingClientRect();
    return [Math.floor((ev.clientX-rc.left)/CELL), Math.floor((ev.clientY-rc.top)/CELL)]; }
  function onMove(ev){ uiRef.current.hover=cellFromEvent(ev); }
  function onLeave(){ uiRef.current.hover=null; }
  function onClick(ev){
    const [c,r]=cellFromEvent(ev); if(c<0||c>=COLS||r<0||r>=ROWS)return;
    const hit=towers.current.find(t=>t.c===c&&t.r===r);
    if(hit){ setSelId(hit.id); setBuild(null); return; }
    if(build){ if(isPath(c,r))return;
      const cost=TOWER[build].cost; if(gold.current<cost){ flashNoGold(); return; }
      gold.current-=cost; const p=cellPx(c,r);
      towers.current.push({ id:idc.current++, el:build, c, r, x:p.x, y:p.y, lvl:1, cd:0, ang:0, recoil:0, invested:cost });
      ringFx(p.x,p.y,ELE[build].glow,4,26,.4);
      syncUi(); saveGame(); return; }
    setSelId(null);
  }
  function flashNoGold(){ setNoGold(true); setTimeout(()=>setNoGold(false),450); }
  function doUpgrade(){ const t=towers.current.find(x=>x.id===selId); if(!t||t.lvl>=MAX_LV)return;
    const c=upgradeCost(t.el,t.lvl); if(gold.current<c){ flashNoGold(); return; }
    gold.current-=c; t.lvl++; t.invested+=c; ringFx(t.x,t.y,"#fde047",6,30,.45); syncUi(); setTick(x=>x+1); saveGame(); }
  function doSell(){ const i=towers.current.findIndex(x=>x.id===selId); if(i<0)return;
    const t=towers.current[i]; gold.current+=Math.round(t.invested*0.6); towers.current.splice(i,1);
    setSelId(null); syncUi(); saveGame(); }
  function restart(){
    enemies.current=[]; towers.current=[]; shots.current=[]; parts.current=[]; floats.current=[];
    hp.current=20; gold.current=180; wave.current=0; kills.current=0; phase.current="build";
    queue.current=[]; qIdx.current=0; endless.current=false;
    nextWaveRef.current=genWave(1); updPreview();
    shake.current={t:0,mag:0}; setResult(null); setVictory(false); setSelId(null); setBuild(null);
    setPhaseS("build"); setAut(false); auto.current=false; syncUi();
    clearTdSave();
  }
  function goEndless(){ endless.current=true; setVictory(false); phase.current="build"; setPhaseS("build"); saveGame(); }

  const selTower=selId!=null?towers.current.find(t=>t.id===selId):null;

  /* ===================== JSX ===================== */
  return (
    <div className="min-h-screen w-full text-slate-100 p-3 flex flex-col items-center"
      style={{background:"radial-gradient(1200px 600px at 50% -10%, #1e1b4b55, transparent), #070b16"}}>
      {loadedMsg && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-slate-100 text-slate-900 font-bold shadow-2xl pop">{loadedMsg}</div>}
      <div className="glass rounded-2xl px-4 py-2.5 mb-3 flex items-center gap-3 shadow-xl flex-wrap" style={{width:SIZE}}>
        <div className="font-black text-lg bg-gradient-to-r from-sky-300 to-violet-400 bg-clip-text text-transparent">🛡️ 9속성 타워 디펜스</div>
        <div className="flex-1"></div>
        <Hud icon="❤️" val={ui.hp} sub="/20" color="#ef4444"/>
        <Hud icon="💰" val={ui.gold} color="#eab308" pulse={noGold}/>
        <Hud icon="🌊" val={ui.wave} sub={endless.current?" ∞":" /"+VICTORY_WAVE} color="#38bdf8"/>
        <Hud icon="💀" val={ui.kills} color="#94a3b8"/>
        <Hud icon="🏆" val={ui.best} color="#fde047"/>
      </div>

      <div className="flex gap-3 items-start" style={{maxWidth:SIZE+230}}>
        <div className="relative">
          <canvas ref={canvasRef} onClick={onClick} onMouseMove={onMove} onMouseLeave={onLeave}
            className="shadow-2xl cursor-crosshair" style={{border:"1px solid rgba(255,255,255,.08)"}}/>
          <div className="glass rounded-xl mt-3 px-3 py-2 flex items-center gap-2 flex-wrap">
            <button onClick={startWave} disabled={phaseS!=="build"}
              className="btng px-4 py-2 rounded-lg font-black text-slate-900 bg-gradient-to-r from-emerald-400 to-green-500 disabled:opacity-40 disabled:cursor-not-allowed shadow">
              {phaseS==="wave"?"⚔️ 전투 중...":"▶ 웨이브 "+(ui.wave+1)+" 시작"}
            </button>
            <button onClick={()=>{paused.current=!paused.current; setTick(x=>x+1);}}
              className="btng px-3 py-2 rounded-lg font-bold glass">{paused.current?"▶ 재개":"⏸ 정지"}</button>
            <button onClick={()=>setSpd(s=>s===1?2:s===2?3:1)}
              className={"btng px-3 py-2 rounded-lg font-bold "+(spd>1?"bg-violet-500 text-white":"glass")}>x{spd}</button>
            <button onClick={()=>setAut(a=>!a)}
              className={"btng px-3 py-2 rounded-lg font-bold "+(aut?"bg-sky-500 text-white":"glass")}>🔁 자동</button>
            <button onClick={()=>{ if(confirmNew){ restart(); setConfirmNew(false); } else { setConfirmNew(true); setTimeout(()=>setConfirmNew(false),3000); } }}
              className={"btng px-3 py-2 rounded-lg font-bold text-xs "+(confirmNew?"bg-rose-600 text-white":"glass")}>
              {confirmNew?"⚠️ 한번 더 누르면 초기화":"🗑️ 새 게임"}
            </button>
            <div className="flex-1"></div>
            {preview && (
              <div className="text-[11px] text-slate-300 flex items-center gap-1.5">
                <span className="text-slate-500">다음:</span>
                <span className="font-bold" style={{color:ELE[preview.primary].color}}>{ELE[preview.primary].emoji}{ELE[preview.primary].name}</span>
                <span>👾{preview.cnt.normal}</span>
                {preview.cnt.fast>0&&<span className="text-sky-300">»{preview.cnt.fast}</span>}
                {preview.cnt.tank>0&&<span className="text-slate-200">🛡{preview.cnt.tank}</span>}
                {preview.cnt.boss>0&&<span className="text-amber-300 font-bold">👑보스!</span>}
              </div>
            )}
          </div>
        </div>

        <div className="w-[210px] flex flex-col gap-2">
          {selTower ? (
            <TowerPanel t={selTower} gold={ui.gold} onUp={doUpgrade} onSell={doSell} onClose={()=>setSelId(null)}/>
          ) : (
            <div className="glass rounded-xl p-2.5 fadein">
              <div className="text-xs font-bold text-slate-300 mb-2">🏗️ 타워 건설 {build&&<span className="text-sky-300">· 맵 클릭</span>}</div>
              <div className="grid grid-cols-3 gap-1.5">
                {EKEYS.map(el=>{
                  const b=TOWER[el],can=ui.gold>=b.cost,on=build===el;
                  return (
                    <button key={el} onClick={()=>{setBuild(on?null:el); setSelId(null);}}
                      className={"btng rounded-lg p-1.5 flex flex-col items-center border transition "+(on?"ring-2":"")}
                      style={{borderColor:ELE[el].color+"66",background:on?ELE[el].color+"33":"rgba(30,41,59,.5)",opacity:can?1:.45,boxShadow:on?"0 0 0 2px "+ELE[el].color:"none"}}>
                      <div className="text-lg leading-none">{ELE[el].emoji}</div>
                      <div className="text-[10px] font-bold" style={{color:ELE[el].color}}>{ELE[el].name}</div>
                      <div className="text-[9px] text-amber-300">{b.cost}G</div>
                    </button>
                  );
                })}
              </div>
              {build && (
                <div className="mt-2 text-[10px] text-slate-300 border-t border-slate-700 pt-2 fadein">
                  <div className="font-bold text-[11px]" style={{color:ELE[build].color}}>{TOWER[build].name} · {TOWER[build].role}</div>
                  <div className="text-slate-400">⚔️{TOWER[build].dmg} · 🎯{TOWER[build].range} · ⚡{TOWER[build].rate}/s{TOWER[build].splash>0?" · 💥광역":""}</div>
                  <div className="mt-1 rounded-lg bg-slate-800/70 p-1.5">
                    <span className="font-bold text-amber-300">✦ {TOWER[build].skill}</span>
                    <div className="text-slate-300 leading-snug">{TOWER[build].skillDesc}</div>
                  </div>
                  <AdvHint el={build}/>
                </div>
              )}
            </div>
          )}
          <div className="glass rounded-xl p-2.5 text-[10px] text-slate-400 leading-relaxed">
            <div className="font-bold text-slate-300 mb-1">📖 상성 가이드</div>
            🔥→🌿⚙️ · 💧→🔥🪨 · 🌿→🪨💧 <span className="text-emerald-400">(1.5x)</span><br/>
            ✨↔🌌 <span className="text-amber-300">(2.0x)</span> · 🏛️ 무상성·룬각인<br/>
            <span className="text-slate-500">{VICTORY_WAVE}웨이브 방어 시 승리! 그 후 무한 모드.</span>
          </div>
        </div>
      </div>

      {result && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="glass rounded-2xl p-8 text-center pop max-w-sm">
            <div className="text-6xl mb-2">💀</div>
            <div className="text-2xl font-black text-red-400 mb-3">방어 실패!</div>
            <div className="grid grid-cols-2 gap-2 mb-5 text-sm">
              <div className="rounded-xl bg-slate-800/70 p-2"><div className="text-slate-400 text-xs">도달 웨이브</div><div className="text-2xl font-black text-amber-300">{result.wave}</div></div>
              <div className="rounded-xl bg-slate-800/70 p-2"><div className="text-slate-400 text-xs">처치 수</div><div className="text-2xl font-black text-slate-200">{result.kills}</div></div>
            </div>
            <div className="text-xs text-slate-400 mb-4">🏆 최고 기록: <b className="text-yellow-300">웨이브 {result.best}</b></div>
            <button onClick={restart} className="btng w-full py-3 rounded-xl font-black text-slate-900 bg-gradient-to-r from-sky-400 to-violet-400 shadow-lg">🔄 다시 도전</button>
          </div>
        </div>
      )}
      {victory && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="glass rounded-2xl p-8 text-center pop max-w-sm" style={{borderColor:"#fde04788"}}>
            <div className="text-6xl mb-2">🏆</div>
            <div className="text-2xl font-black text-amber-300 mb-1">완벽 방어 성공!</div>
            <div className="text-slate-300 text-sm mb-5">{VICTORY_WAVE}개의 웨이브를 모두 막아냈어요!<br/>처치 <b>{ui.kills}</b> · 남은 HP <b>{ui.hp}</b></div>
            <button onClick={goEndless} className="btng w-full py-3 rounded-xl font-black text-slate-900 bg-gradient-to-r from-amber-300 to-yellow-400 shadow-lg mb-2">♾️ 무한 모드 계속</button>
            <button onClick={restart} className="btng w-full py-2 rounded-xl font-bold glass">🔄 처음부터</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Hud({icon,val,sub,color,pulse}){
  return <div className={"flex items-center gap-1 "+(pulse?"pulse-red rounded-lg":"")}>
    <span className="text-base">{icon}</span>
    <span className="font-black tabular-nums" style={{color}}>{val}<span className="text-[10px] text-slate-400 font-normal">{sub}</span></span>
  </div>;
}
function AdvHint({el}){
  const m=ADV[el]; const ks=Object.keys(m);
  if(el==="ancient") return <div className="mt-1" style={{color:"#fcd34d"}}>상성 없음 · 압도적 위력</div>;
  if(!ks.length) return <div className="mt-1 text-slate-500">상성 없음 (스킬 특화)</div>;
  return <div className="mt-1">{ks.map(k=><span key={k} style={{color:ELE[k]?ELE[k].color:"#fff"}}>{ELE[k].emoji}{m[k]}x </span>)}</div>;
}
function TowerPanel({t,gold,onUp,onSell,onClose}){
  const s=towerStat(t.el,t.lvl); const c=ELE[t.el]; const up=upgradeCost(t.el,t.lvl); const maxed=t.lvl>=MAX_LV;
  const nx=maxed?null:towerStat(t.el,t.lvl+1);
  return (
    <div className="glass rounded-xl p-3 fadein" style={{borderColor:c.color+"66"}}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2"><span className="text-2xl">{c.emoji}</span>
          <div><div className="font-black" style={{color:c.color}}>{TOWER[t.el].name}</div>
            <div className="text-[10px] text-slate-400">Lv.{t.lvl}{maxed?" (MAX)":""} · {TOWER[t.el].role}</div></div></div>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-lg leading-none">✕</button>
      </div>
      <div className="grid grid-cols-3 gap-1 text-center text-[11px] mb-2">
        <Stat label="공격" val={Math.round(s.dmg)} nxt={nx&&Math.round(nx.dmg)} color="text-red-300"/>
        <Stat label="사거리" val={s.range.toFixed(1)} nxt={nx&&nx.range.toFixed(1)} color="text-sky-300"/>
        <Stat label="연사" val={s.rate.toFixed(1)} nxt={nx&&nx.rate.toFixed(1)} color="text-emerald-300"/>
      </div>
      <div className="rounded-lg bg-slate-800/70 p-1.5 text-[10px] mb-2">
        <span className="font-bold text-amber-300">✦ {TOWER[t.el].skill}</span>
        <div className="text-slate-300 leading-snug">{TOWER[t.el].skillDesc}</div>
      </div>
      <button onClick={onUp} disabled={maxed||gold<up}
        className="btng w-full py-2 rounded-lg font-bold text-slate-900 bg-gradient-to-r from-amber-300 to-yellow-400 disabled:opacity-40 mb-1.5">
        {maxed?"최대 레벨":"⬆ 업그레이드 ("+up+"G)"}
      </button>
      <button onClick={onSell} className="btng w-full py-1.5 rounded-lg font-bold text-xs bg-slate-700 hover:bg-rose-600/70">💰 판매 (+{Math.round(t.invested*0.6)}G)</button>
    </div>
  );
}
function Stat({label,val,nxt,color}){
  return <div className="rounded-lg bg-slate-800/60 py-1">
    <div className="text-slate-400">{label}</div>
    <div className={"font-bold "+color}>{val}{nxt!=null&&<span className="text-[9px] text-emerald-400"> →{nxt}</span>}</div>
  </div>;
}
function roundRect(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r);
  g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }

ReactDOM.createRoot(document.getElementById("root")).render(<Game/>);
</script>
</body>
</html>'''


def rpg_page():
    st.title("🛡️ 9속성 타워 디펜스")
    st.caption("9속성 상성으로 몰려오는 몬스터를 막아라! 타워를 세우고 업그레이드해 무한 웨이브에 도전 · 60FPS 캔버스 엔진")
    components.html(TOWER_DEFENSE_HTML, height=780, scrolling=True)


# ==========================================
# 6.5. 워들 퍼즐 게임 페이지
# ==========================================
def check_wordle_guess(target, guess):
    result = [None] * 5
    target_letter_counts = {}
    for char in target:
        target_letter_counts[char] = target_letter_counts.get(char, 0) + 1
        
    # First pass: Green (exact match)
    for i in range(5):
        if guess[i] == target[i]:
            result[i] = 'green'
            target_letter_counts[guess[i]] -= 1
            
    # Second pass: Yellow (exist in target but wrong position) or Gray (not in target)
    for i in range(5):
        if result[i] is None:
            char = guess[i]
            if char in target_letter_counts and target_letter_counts[char] > 0:
                result[i] = 'yellow'
                target_letter_counts[char] -= 1
            else:
                result[i] = 'gray'
    return result

def wordle_page():
    st.title("🔠 워들 (Wordle) 단어 퍼즐")
    st.write("컴퓨터가 생각한 5글자 영어 단어를 6번의 기회 안에 맞춰보세요!")
    
    # 5글자 영어 단어 풀
    WORD_POOL = [
        "APPLE", "HOUSE", "WORLD", "LIGHT", "WATER", "SMART", "BRAIN", "PLANT", "SWEET", "TRAIN", 
        "PIANO", "STORM", "CRANE", "SNAKE", "GRAPE", "CHAIR", "TABLE", "STARS", "CLOCK", "STONE", 
        "SHINE", "DREAM", "FLAME", "GREEN", "NIGHT", "BEACH", "OCEAN", "SMILE", "CLOUD", "BREAD", 
        "FRUIT", "HEART", "PAPER", "SOUND", "VOICE", "PEACE", "TRUTH", "WHITE", "BLACK", "ABOUT", 
        "WRITE", "GUIDE", "PENCIL", "MOUSE", "LOGIC", "CHECK", "BRICK", "BOARD", "GLASS", "SHIRT",
        "TIGER", "HORSE", "SHARK", "LEMON", "HONEY", "MELON", "JUICE", "EARTH", "SPACE", "RIVER",
        "MOUNT", "ROBOT", "MAGIC", "MUSIC", "MOVIE", "FLUTE", "GRASS", "FLOWER", "LEAFY", "HAPPY", 
        "SLEEP", "LUCKY", "CLEAN", "DRINK", "MATCH", "SCORE", "SOUTH", "NORTH", "CANDY"
    ]
    
    # 중복 제거 및 대문자 변환
    WORD_POOL = list(set([w.upper() for w in WORD_POOL]))

    if "w_target" not in st.session_state:
        st.session_state.w_target = random.choice(WORD_POOL)
        st.session_state.w_guesses = []
        st.session_state.w_game_over = False
        st.session_state.w_won = False
        st.session_state.w_error_msg = ""

    # UI 스타일 정의 및 6x5 그리드 렌더링
    st.write(
        """
        <style>
        .wordle-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            margin: 20px 0;
        }
        .wordle-row {
            display: flex;
            gap: 8px;
        }
        .wordle-cell {
            width: 55px;
            height: 55px;
            border: 2px solid #565758;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 26px;
            font-weight: bold;
            text-transform: uppercase;
            color: white;
        }
        .cell-green { background-color: #6aaa64; border-color: #6aaa64; }
        .cell-yellow { background-color: #c9b458; border-color: #c9b458; }
        .cell-gray { background-color: #3a3a3c; border-color: #3a3a3c; }
        .cell-empty { background-color: transparent; border-color: #565758; color: inherit; }

        .keyboard-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            margin: 20px 0;
        }
        .keyboard-row {
            display: flex;
            gap: 6px;
        }
        .key {
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: bold;
            text-transform: uppercase;
            text-align: center;
            min-width: 32px;
        }
        .key-default { background-color: #818384; color: white; }
        .key-green { background-color: #6aaa64; color: white; }
        .key-yellow { background-color: #c9b458; color: white; }
        .key-gray { background-color: #3a3a3c; color: white; }
        </style>
        """,
        unsafe_allow_html=True
    )

    target = st.session_state.w_target
    guesses = st.session_state.w_guesses
    
    # 6x5 그리드 그리기
    grid_html = "<div class='wordle-container'>"
    for row_idx in range(6):
        grid_html += "<div class='wordle-row'>"
        if row_idx < len(guesses):
            guess = guesses[row_idx]
            colors = check_wordle_guess(target, guess)
            for col_idx in range(5):
                char = guess[col_idx]
                color = colors[col_idx]
                grid_html += f"<div class='wordle-cell cell-{color}'>{char}</div>"
        else:
            for col_idx in range(5):
                grid_html += "<div class='wordle-cell cell-empty'></div>"
        grid_html += "</div>"
    grid_html += "</div>"
    
    st.markdown(grid_html, unsafe_allow_html=True)

    # 실시간 키보드 상태 갱신
    letter_states = {chr(i): "default" for i in range(65, 91)}
    for g in guesses:
        colors = check_wordle_guess(target, g)
        for idx, char in enumerate(g):
            current_state = letter_states[char]
            color = colors[idx]
            if color == "green":
                letter_states[char] = "green"
            elif color == "yellow":
                if current_state != "green":
                    letter_states[char] = "yellow"
            elif color == "gray":
                if current_state not in ("green", "yellow"):
                    letter_states[char] = "gray"

    # 가상 키보드 렌더링
    keyboard_rows = [
        ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
        ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
        ["Z", "X", "C", "V", "B", "N", "M"]
    ]
    
    kb_html = "<div class='keyboard-container'>"
    for row in keyboard_rows:
        kb_html += "<div class='keyboard-row'>"
        for key in row:
            state = letter_states[key]
            kb_html += f"<div class='key key-{state}'>{key}</div>"
        kb_html += "</div>"
    kb_html += "</div>"
    
    st.markdown(kb_html, unsafe_allow_html=True)

    st.divider()
    
    if st.session_state.w_game_over:
        if st.session_state.w_won:
            st.success(f"🎉 축하합니다! {len(guesses)}번째 시도 만에 정답 [{target}]을(를) 맞추셨습니다!")
        else:
            st.error(f"😢 아쉽게도 실패했습니다. 컴퓨터가 생각한 단어는 **{target}** 이었습니다.")
    else:
        st.subheader("✍️ 단어 입력")
        with st.form(key="wordle_form", clear_on_submit=True):
            user_input = st.text_input("5글자 영어 단어를 입력하세요 (영어만 가능)", max_chars=5)
            submit_btn = st.form_submit_button("확인")
            
        if submit_btn:
            user_input = user_input.strip().upper()
            if len(user_input) != 5:
                st.session_state.w_error_msg = "⚠️ 반드시 5글자여야 합니다!"
            elif not user_input.isalpha():
                st.session_state.w_error_msg = "⚠️ 알파벳으로만 구성된 단어여야 합니다!"
            else:
                st.session_state.w_error_msg = ""
                st.session_state.w_guesses.append(user_input)
                
                # 결과 확인
                if user_input == target:
                    st.session_state.w_game_over = True
                    st.session_state.w_won = True
                elif len(st.session_state.w_guesses) >= 6:
                    st.session_state.w_game_over = True
                    st.session_state.w_won = False
                st.rerun()
                
        if st.session_state.w_error_msg:
            st.warning(st.session_state.w_error_msg)
            
    if st.button("🔄 새로운 단어로 재시작"):
        if "w_target" in st.session_state: del st.session_state.w_target
        if "w_guesses" in st.session_state: del st.session_state.w_guesses
        if "w_game_over" in st.session_state: del st.session_state.w_game_over
        if "w_won" in st.session_state: del st.session_state.w_won
        if "w_error_msg" in st.session_state: del st.session_state.w_error_msg
        st.rerun()



# ==========================================
# 6.8. 마법학교 신입생의 하루 텍스트 어드벤처
# ==========================================
def update_adv_stats(hp_change=0, mp_change=0, rep_change=0, log_msg=""):
    st.session_state.adv_hp = max(0, min(100, st.session_state.adv_hp + hp_change))
    st.session_state.adv_mp = max(0, min(100, st.session_state.adv_mp + mp_change))
    st.session_state.adv_rep = max(0, min(100, st.session_state.adv_rep + rep_change))
    if log_msg:
        st.session_state.adv_log.insert(0, log_msg)
    
    if st.session_state.adv_hp <= 0:
        st.session_state.adv_step = "ending_hospital"
        st.session_state.adv_log.insert(0, "🏥 [체력 고갈] 과도한 부상과 피로로 정신을 잃고 양로실로 후송되었습니다!")

def adventure_page():
    st.title("🧙 🗺️ 선택형 텍스트 어드벤처: 마법학교 신입생의 하루")
    st.write("선택과 운명(주사위)의 결합! 하루 동안 마법학교의 돌발 상황들을 해결해 나가세요.")
    
    # 데이터 세션 상태 초기화
    if "adv_step" not in st.session_state:
        st.session_state.adv_step = "dorm_morning"
        st.session_state.adv_hp = 100
        st.session_state.adv_mp = 50
        st.session_state.adv_rep = 50
        st.session_state.adv_log = ["마법학교 신입생 모험이 시작되었습니다!"]
        st.session_state.adv_dice_val = None
        st.session_state.adv_temp_step = None

    # 상태창 대시보드
    st.subheader("🎒 마법 신입생 상태창")
    c1, c2, c3 = st.columns(3)
    c1.metric("❤️ 체력 (HP)", f"{st.session_state.adv_hp} / 100")
    c1.progress(max(0.0, min(1.0, st.session_state.adv_hp / 100.0)))
    
    c2.metric("🧪 마력 (Mana)", f"{st.session_state.adv_mp} / 100")
    c2.progress(max(0.0, min(1.0, st.session_state.adv_mp / 100.0)))
    
    c3.metric("🌟 학업 평판 (Reputation)", f"{st.session_state.adv_rep} / 100")
    c3.progress(max(0.0, min(1.0, st.session_state.adv_rep / 100.0)))

    st.divider()

    step = st.session_state.adv_step

    # 각 씬 렌더링 카드 정의
    scenes = {
        # ------------------------------------------
        # 1. 아침 씬
        # ------------------------------------------
        "dorm_morning": {
            "title": "⏰ 기숙사 침대 (오전 8시 30분)",
            "desc": "알람 소리에 눈을 떴습니다! 마법 기초학 첫 수업이 9시에 시작하는데 기숙사 침대입니다. 지금 서두르지 않으면 영락없이 지각입니다! 어떻게 할까요?",
            "type": "choices",
            "options": [
                {"text": "🏃 번개처럼 준비해서 전속력으로 뛰어간다 (체력 -15, 평판 +5)", "action": lambda: (update_adv_stats(hp_change=-15, rep_change=5, log_msg="🏃 지각하지 않기 위해 번개처럼 뛰어가 정시 세이프에 성공했습니다!"), st.session_state.update({"adv_step": "classroom"}), st.rerun())},
                {"text": "🪄 텔레포트 주문서 사용하기 (마력 -10, 주사위 롤 필요)", "action": lambda: (st.session_state.update({"adv_step": "dorm_teleport"}), st.rerun())},
                {"text": "💤 5분만 더 단잠을 청하고 지각한다 (평판 -20)", "action": lambda: (update_adv_stats(rep_change=-20, log_msg="💤 단잠의 대가는 혹독했습니다. 완전히 늦어 지각 확정입니다!"), st.session_state.update({"adv_step": "classroom_late"}), st.rerun())}
            ]
        },
        "dorm_teleport": {
            "title": "🪄 텔레포트 비급 시험",
            "desc": "텔레포트 주문서를 펼쳤습니다. 공간 이동 마법은 아직 서툴러서 성공하려면 <strong>주사위 3 이상</strong>이 나와야 합니다. 2 이하가 나올 경우 공간 차원의 균열로 엉뚱한 곳에 떨어질 수 있습니다!",
            "type": "dice",
            "target": 3,
            "success_step": "classroom",
            "fail_step": "dungeon",
            "success_action": lambda d: update_adv_stats(mp_change=-10, rep_change=10, log_msg=f"🎲 주사위 {d}! 공간 전송 성공! 강의실 앞자리에 폼나게 떨어졌습니다."),
            "fail_action": lambda d: update_adv_stats(hp_change=-20, mp_change=-10, log_msg=f"🎲 주사위 {d}! 대실패! 지옥 차원 균열을 통해 지하 깊은 던전에 떨어졌습니다!")
        },

        # ------------------------------------------
        # 2. 교실 씬 (정상)
        # ------------------------------------------
        "classroom": {
            "title": "🔥 마법 기초 강의실",
            "desc": "아그니 교수님이 불꽃 마법(파이어볼) 소환 시범을 마친 후 실습을 요구하십니다. 붉은 불꽃이 시연 테이블 위에서 춤추고 있습니다. 무엇을 하시겠습니까?",
            "type": "choices",
            "options": [
                {"text": "☄️ 직접 불꽃 마법 시전 연습하기 (마력 -20, 미니 퀴즈 돌입)", "action": lambda: (st.session_state.update({"adv_step": "classroom_quiz"}), st.rerun())},
                {"text": "✍️ 얌전하게 필기하며 모범생인 척하기 (체력 +10, 평판 +15)", "action": lambda: (update_adv_stats(hp_change=10, rep_change=15, log_msg="✍️ 꼼꼼하게 필기하여 교수님의 학구열 칭찬을 받았습니다."), st.session_state.update({"adv_step": "lunch"}), st.rerun())},
                {"text": "💤 책상 밑에서 몰래 쪽잠 자기 (체력 +20, 마력 +10, 평판 -15)", "action": lambda: (update_adv_stats(hp_change=20, mp_change=10, rep_change=-15, log_msg="💤 아그니 교수님이 졸고 있는 당신의 머리맡에 작은 연기 폭탄을 날려 화들짝 잠에서 깼습니다."), st.session_state.update({"adv_step": "lunch"}), st.rerun())}
            ]
        },
        "classroom_quiz": {
            "title": "✏️ 불꽃 주문 퀴즈!",
            "desc": "파이어볼을 소환하기 위해 올바른 영창 단어를 기억해내야 합니다. 다음 중 마법 주문학 책에 나오는 '불꽃 소환' 라틴어 스펠은 무엇일까요?",
            "type": "quiz",
            "question": "Q. '불을 밝히다, 불 지르다'라는 어원을 가진 불꽃 공격 마법의 알맞은 명칭은?",
            "answers": ["Lumos", "Incendio", "Alohomora"],
            "correct_idx": 1,
            "success_action": lambda: update_adv_stats(mp_change=-20, rep_change=20, log_msg="🔥 [정답] Incendio! 주문 시전 성공! 교수님이 당신의 뛰어난 직관에 큰 점수를 주십니다."),
            "fail_action": lambda: update_adv_stats(hp_change=-25, mp_change=-20, rep_change=-10, log_msg="💥 [오답] 주문을 잘못 읊는 바람에 시연용 화로가 폭발하여 얼굴에 검댕이 그을리고 체력이 깎였습니다!"),
            "next_step": "lunch"
        },

        # ------------------------------------------
        # 3. 교실 씬 (지각)
        # ------------------------------------------
        "classroom_late": {
            "title": "🚪 강의실 뒷문 (지각 상황)",
            "desc": "조심스레 강의실 뒷문을 열었으나, 살벌한 눈빛의 아그니 교수님과 눈이 정확히 마주쳤습니다! 강의실 공기가 얼어붙었습니다. 어떻게 대처할까요?",
            "type": "choices",
            "options": [
                {"text": "🙇 90도로 사과하고 방과 후 자율 청소 약속하기 (체력 -10, 평판 -5)", "action": lambda: (update_adv_stats(hp_change=-10, rep_change=-5, log_msg="🙇 솔직한 사과로 징계는 면했지만, 방과 후 실험실 물총 청소가 예약되었습니다."), st.session_state.update({"adv_step": "lunch"}), st.rerun())},
                {"text": "🏃 눈감고 자리에 쏜살같이 대시해 앉기 (주사위 4 이상 필요)", "action": lambda: (st.session_state.update({"adv_step": "classroom_late_dash"}), st.rerun())}
            ]
        },
        "classroom_late_dash": {
            "title": "🏃 닌자식 순간 대시 시도",
            "desc": "교수님의 시선을 피해 찰나의 틈을 타 빈 좌석으로 대시해야 합니다. 성공하려면 **주사위 4 이상**이 나와야 정숙하게 착석할 수 있습니다. 실패하면 대참사가 일어납니다!",
            "type": "dice",
            "target": 4,
            "success_step": "lunch",
            "fail_step": "lunch",
            "success_action": lambda d: update_adv_stats(rep_change=5, log_msg=f"🎲 주사위 {d}! 대시 성공! 신속하게 미끄러져 들어가 아무도 눈치채지 못하게 착석했습니다."),
            "fail_action": lambda d: update_adv_stats(hp_change=-20, rep_change=-20, log_msg=f"🎲 주사위 {d}! 실패! 뛰어가다 교탁 다리에 발가락을 부딪치며 넘어지는 바람에 웃음거리로 전락했습니다.")
        },

        # ------------------------------------------
        # 4. 식당 씬
        # ------------------------------------------
        "lunch": {
            "title": "🍚 마법학교 대식당 (점심)",
            "desc": "기진맥진한 상태로 식당에 입성했습니다. 한 구석에서 소매가 닳은 로브를 입은 3학년 선배가 음흉한 미소를 지으며 무언가 약병을 흔들고 있습니다. '신입생, 이거 마셔봐. 내 졸업 연구작인데 마력이 순식간에 회복된다고!' 어떻게 할까요?",
            "type": "choices",
            "options": [
                {"text": "🧪 강해지고 싶다! 선배의 비약을 들이킨다 (주사위 4 이상 성공)", "action": lambda: (st.session_state.update({"adv_step": "lunch_potion"}), st.rerun())},
                {"text": "🍚 돈 낭비다. 그냥 일반 학식을 건강히 먹는다 (체력 +30)", "action": lambda: (update_adv_stats(hp_change=30, log_msg="🍚 맛있는 등심 오므라이스 학식을 꼭꼭 씹어 먹고 기력을 완전히 회복했습니다."), st.session_state.update({"adv_step": "afternoon"}), st.rerun())},
                {"text": "⚔️ '수상한 물약을 신입생에게 팔다니! 마법 듀얼이다!' 듀얼을 신청한다", "action": lambda: (update_adv_stats(rep_change=10, log_msg="⚔️ 기백 좋게 선배에게 정식 듀얼을 요구해 식당 구경꾼들의 환호를 받았습니다!"), st.session_state.update({"adv_step": "duel"}), st.rerun())}
            ]
        },
        "lunch_potion": {
            "title": "🧪 의문의 약물 투여",
            "desc": "물약을 다 마셨습니다! <strong>주사위 4 이상</strong>이 나오면 마력이 비약적으로 정제되어 증폭되지만, 3 이하가 나오면 몸이 부작용으로 개구리로 변할 것입니다...",
            "type": "dice",
            "target": 4,
            "success_step": "afternoon",
            "fail_step": "ending_frog",
            "success_action": lambda d: update_adv_stats(mp_change=50, hp_change=10, log_msg=f"🎲 주사위 {d}! 비약 대성공! 마나 정맥이 활성화되어 마력이 50 상승했습니다!"),
            "fail_action": lambda d: update_adv_stats(log_msg=f"🎲 주사위 {d}! 부작용 대폭발! 온몸에 털과 함께 피부가 초록색으로 변해 개구리가 되었습니다!")
        },

        # ------------------------------------------
        # 5. 듀얼 씬
        # ------------------------------------------
        "duel": {
            "title": "⚔️ 야외 연무장 결투",
            "desc": "선배가 번개 소환 주문을 읊기 시작했습니다! 웅웅거리는 전류가 당신을 조여옵니다. 선배를 제압하고 승리하려면 마나 30을 안전하게 소모해 실드를 켜거나, 운에 맡기고 주사위 대결을 벌여야 합니다.",
            "type": "choices",
            "options": [
                {"text": "🛡️ 마법 방어막(실드) 전개 (마력 -30, 안전 성공, 평판 +30)", "action": lambda: (update_adv_stats(mp_change=-30, rep_change=30, log_msg="🛡️ 마나 보호막을 펼쳐 적의 번개를 완전히 반사하고 카운터를 꽂아 결투에서 이겼습니다!"), st.session_state.update({"adv_step": "afternoon"}), st.rerun())},
                {"text": "🎲 맞대응 마법 영창 (주사위 5 이상 필요, 실패시 큰 화를 입음)", "action": lambda: (st.session_state.update({"adv_step": "duel_roll"}), st.rerun())},
                {"text": "🏃 '이건 선배가 반칙이에요!' 소리치고 도망치기 (평판 -30, 체력 -10)", "action": lambda: (update_adv_stats(hp_change=-10, rep_change=-30, log_msg="🏃 결투 직전 겁을 먹고 뒤를 돌아서 도망쳐 한동안 겁쟁이로 놀림받게 되었습니다."), st.session_state.update({"adv_step": "afternoon"}), st.rerun())}
            ]
        },
        "duel_roll": {
            "title": "🎲 운명의 스펠 충돌",
            "desc": "서로의 주문이 부딪힙니다! 이 기세를 뚫고 승리하려면 **주사위 5 이상**이 나와야 합니다. 실패하면 강력한 감전 충격으로 큰 화상을 입습니다.",
            "type": "dice",
            "target": 5,
            "success_step": "afternoon",
            "fail_step": "afternoon",
            "success_action": lambda d: update_adv_stats(rep_change=45, log_msg=f"🎲 주사위 {d}! 대역전 극장! 번개를 가르고 화려하게 불꽃 강타로 선배를 쓰러트리며 결투장에서 위상을 넓혔습니다!"),
            "fail_action": lambda d: update_adv_stats(hp_change=-50, rep_change=-15, log_msg=f"🎲 주사위 {d}! 감전 패배... 직격타로 온몸에 마비가 와 뒹굴며 막대한 피해를 입었습니다.")
        },

        # ------------------------------------------
        # 6. 지하실 던전 씬
        # ------------------------------------------
        "dungeon": {
            "title": "🕸️ 축축한 지하실 던전",
            "desc": "공간 균열로 떨어진 이곳은 먼지 쌓인 지하 감옥 던전입니다. 눈앞에 보라색 산성 맹독을 질질 흘리는 거대 슬라임 보스가 다가옵니다! 어떻게 탈출할까요?",
            "type": "choices",
            "options": [
                {"text": "☄️ 파이어 스펠로 슬라임 증발시키기 (마력 -20, 평판 +20)", "action": lambda: (update_adv_stats(mp_change=-20, rep_change=20, log_msg="☄️ 파이어 마법을 난사하여 보라색 슬라임을 수증기로 말려 없애고 무사히 탈출했습니다."), st.session_state.update({"adv_step": "afternoon"}), st.rerun())},
                {"text": "⚔️ 고드름을 깎아 물리적으로 약점 던지기 (주사위 4 이상 성공)", "action": lambda: (st.session_state.update({"adv_step": "dungeon_throw"}), st.rerun())},
                {"text": "🏃 아무 공격도 안 하고 뒤도 안 돌아보고 도망가기 (체력 -30)", "action": lambda: (update_adv_stats(hp_change=-30, log_msg="🏃 던전 비상구로 필사적으로 달리다가 슬라임이 뿜어댄 맹독 파편에 맞아 엉덩이가 다쳤습니다."), st.session_state.update({"adv_step": "afternoon"}), st.rerun())}
            ]
        },
        "dungeon_throw": {
            "title": "⚔️ 던전 속 절체절명 투척",
            "desc": "돌맹이와 얼음 고드름을 조준해 슬라임 중심부의 마법 코어를 향해 던집니다! <strong>주사위 4 이상</strong>이 나와야 명중하며, 그렇지 않으면 화가 난 슬라임에게 당합니다.",
            "type": "dice",
            "target": 4,
            "success_step": "afternoon",
            "fail_step": "afternoon",
            "success_action": lambda d: update_adv_stats(rep_change=25, log_msg=f"🎲 주사위 {d}! 정확한 샷! 코어가 파괴되어 슬라임이 진흙이 되어 사라지고 포션을 발견하여 무사히 올라왔습니다."),
            "fail_action": lambda d: update_adv_stats(hp_change=-40, log_msg=f"🎲 주사위 {d}! 빗나감! 슬라임이 돌진하여 깔아뭉개지는 충격을 고스란히 받았습니다!")
        },

        # ------------------------------------------
        # 7. 오후 선택 씬
        # ------------------------------------------
        "afternoon": {
            "title": "🌆 마법학교 오후 (오후 3시)",
            "desc": "정신없는 오전 일과가 끝났습니다. 오늘 밤은 9시에 '마법 학업 종합 평가 시험'이 열리는 날입니다. 시험 대비를 위해 무엇을 하며 보낼까요?",
            "type": "choices",
            "options": [
                {"text": "📖 도서관에서 시험 족보 벼락치기 공부하기 (평판 +15, 마력 -10)", "action": lambda: (update_adv_stats(mp_change=-10, rep_change=15, log_msg="📖 도서관에서 어두워질 때까지 실전 시험 족보를 암기했습니다."), st.session_state.update({"adv_step": "evaluation"}), st.rerun())},
                {"text": "🌲 금지된 야생 숲에서 희귀 마법초 캐오기 (체력 -15, 마력 +30)", "action": lambda: (update_adv_stats(hp_change=-15, mp_change=30, log_msg="🌲 숲속 깊이 들어갔다가 신성 마나 풀을 발견해 씹어 먹고 마나를 채웠습니다."), st.session_state.update({"adv_step": "evaluation"}), st.rerun())},
                {"text": "😴 시험이고 뭐고 일단 침대에서 낮잠 자기 (체력 +40, 마력 +20)", "action": lambda: (update_adv_stats(hp_change=40, mp_change=20, log_msg="😴 꿀 같은 낮잠으로 체력과 정신을 최상의 컨디션으로 올렸습니다."), st.session_state.update({"adv_step": "evaluation"}), st.rerun())}
            ]
        },

        # ------------------------------------------
        # 8. 최종 종합 평가
        # ------------------------------------------
        "evaluation": {
            "title": "📝 마법 종합 평가 시험장 (오후 9시)",
            "desc": "시험지가 배부되었습니다! 아그니 교수님이 독기 어린 눈으로 신입생들을 감시하고 있습니다. 마법 지식을 테스트하는 결정적 이론 한 문항이 주어집니다!",
            "type": "quiz",
            "question": "Q. 다음 중 정통 마법을 시전할 때 작용하는 '마법의 3대 요소'로 옳지 않은 것은?",
            "answers": ["마력 (Mana)", "의지 (Will)", "자금 (Gold)"],
            "correct_idx": 2,
            "success_action": lambda: update_adv_stats(rep_change=35, log_msg="📝 정답 제출 완료! 완벽한 답안지에 교수님이 함박웃음을 지으셨습니다. 평판이 오릅니다."),
            "fail_action": lambda: update_adv_stats(rep_change=-25, log_msg="📝 시험 오답 제출... 마법 기초가 전혀 안 되어 있다며 교수님의 탄식이 흐릅니다."),
            "next_step": "determine_ending"
        }
    }

    if step == "determine_ending":
        # 최종 평가 결과에 따라 엔딩 스위칭
        # 1. 체력 0 이하는 이미 update_adv_stats에서 hospital로 분기
        rep = st.session_state.adv_rep
        hp = st.session_state.adv_hp
        
        if rep >= 75 and hp >= 50:
            st.session_state.adv_step = "ending_hero"
        elif rep < 30:
            st.session_state.adv_step = "ending_sleepy"
        else:
            st.session_state.adv_step = "ending_normal"
        st.rerun()

    # 엔딩 씬 데이터 처리
    endings = {
        "ending_hero": {
            "title": "🏆 수석 장학생 영웅 엔딩",
            "desc": "<strong>[수석 신입생 등극]</strong><br>성실함과 뛰어난 용기, 그리고 완벽한 시험 답안으로 교수진 전체의 찬사를 받았습니다! 마학계의 차세대 거물로 인정받아 장학 훈장을 목에 걸었습니다. 최고의 하루였습니다!",
            "color": "green"
        },
        "ending_normal": {
            "title": "🧙 평범한 신입생의 내일 엔딩",
            "desc": "<strong>[무사한 하루]</strong><br>크게 다치지 않고 무난하게 신입생 평가 시험을 통과했습니다. 대단한 사건은 없었지만, 내일도 마법학교의 태양은 뜰 것이고 당신은 조금 더 자라 있을 것입니다. 무던한 성공!",
            "color": "blue"
        },
        "ending_sleepy": {
            "title": "💤 퇴학 조치 및 낙향 엔딩",
            "desc": "<strong>[불성실 퇴학 통보]</strong><br>종일 무단지각을 일삼고 학업에 집중하지 않아 평판이 무참히 박살났습니다. 결국 아그니 교수님이 퇴학 서류에 서명을 하셨습니다... 고향으로 돌아가 평범한 농부가 되어 마법을 그리워할 일만 남았습니다.",
            "color": "orange"
        },
        "ending_frog": {
            "title": "🐸 개구리 조교 펫 엔딩",
            "desc": "<strong>[부작용 극대화]</strong><br>선배의 알 수 없는 비약 부작용으로 인간의 형상을 잃었습니다. 결국 아그니 교수님의 수집장 한 칸에 배치되어 실험 조교용 애완 개구리 신세가 되었습니다. 개굴개굴 노래만 부를 수 있습니다.",
            "color": "purple"
        },
        "ending_hospital": {
            "title": "🏥 양로실 유급 병동 엔딩",
            "desc": "<strong>[체력 고갈 실신]</strong><br>무리한 격투와 모험으로 뼈가 으스러지고 생명력을 잃었습니다. 혼수상태로 실려 가 전치 12주의 판정을 받고 이번 학기 유급이 결정되었습니다. 병동 약을 들이켜며 긴 한숨을 짓습니다.",
            "color": "red"
        }
    }

    # 현재 씬 정보 가져오기
    if step in scenes:
        scene = scenes[step]
        
        st.markdown(
            f"""
            <div style='background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.15); padding: 25px; border-radius: 16px; margin: 20px 0;'>
                <h3 style='color: #38bdf8; margin-top: 0;'>📍 {scene["title"]}</h3>
                <p style='font-size: 16px; line-height: 1.6; color: #f8fafc;'>{scene["desc"]}</p>
            </div>
            """,
            unsafe_allow_html=True
        )

        if scene["type"] == "choices":
            # 선택지 나열
            for idx, opt in enumerate(scene["options"]):
                if st.button(opt["text"], key=f"adv_opt_{idx}", use_container_width=True):
                    opt["action"]()

        elif scene["type"] == "dice":
            # 주사위 이벤트
            st.write(f"🎯 **미션 성공 기준:** 주사위 눈 **{scene['target']} 이상** 필요")
            
            if st.session_state.adv_dice_val is None:
                if st.button("🎲 주사위 던지기", key="adv_roll_btn", use_container_width=True):
                    # 주사위 롤 수행
                    val = random.randint(1, 6)
                    st.session_state.adv_dice_val = val
                    st.rerun()
            else:
                val = st.session_state.adv_dice_val
                st.write(f"### 🎲 주사위 결과: {val}")
                
                if val >= scene["target"]:
                    st.success("🎉 주사위 판정: 성공!")
                    if st.button("확인 후 다음으로", key="adv_dice_next_s", use_container_width=True):
                        scene["success_action"](val)
                        st.session_state.adv_step = scene["success_step"]
                        st.session_state.adv_dice_val = None
                        st.rerun()
                else:
                    st.error("💀 주사위 판정: 실패...")
                    if st.button("확인 후 다음으로", key="adv_dice_next_f", use_container_width=True):
                        scene["fail_action"](val)
                        st.session_state.adv_step = scene["fail_step"]
                        st.session_state.adv_dice_val = None
                        st.rerun()

        elif scene["type"] == "quiz":
            # 퀴즈 이벤트
            st.write(f"### ✏️ {scene['question']}")
            
            # 사용자 답변 양식
            quiz_key = f"quiz_ans_{step}"
            user_ans = st.radio("보기 중 하나를 고르세요", scene["answers"], index=0, key=quiz_key)
            
            if st.button("제출 및 판정", key="quiz_sub_btn", use_container_width=True):
                chosen_idx = scene["answers"].index(user_ans)
                if chosen_idx == scene["correct_idx"]:
                    scene["success_action"]()
                else:
                    scene["fail_action"]()
                
                st.session_state.adv_step = scene["next_step"]
                st.rerun()

    elif step in endings:
        ending = endings[step]
        color_map = {
            "green": "success",
            "blue": "info",
            "orange": "warning",
            "purple": "warning",
            "red": "error"
        }
        status_func = getattr(st, color_map[ending["color"]])
        
        st.markdown(
            f"""
            <div style='background: rgba(255, 255, 255, 0.05); border: 2px solid #ff8787; padding: 25px; border-radius: 16px; margin: 20px 0; text-align: center;'>
                <h2 style='color: #f472b6; margin-top: 0;'>🎬 엔딩: {ending["title"]}</h2>
            </div>
            """,
            unsafe_allow_html=True
        )
        
        status_func(ending["desc"])
        
        if st.button("🔄 처음부터 다시 모험하기", key="restart_adv_btn", use_container_width=True):
            if "adv_step" in st.session_state: del st.session_state.adv_step
            if "adv_hp" in st.session_state: del st.session_state.adv_hp
            if "adv_mp" in st.session_state: del st.session_state.adv_mp
            if "adv_rep" in st.session_state: del st.session_state.adv_rep
            if "adv_log" in st.session_state: del st.session_state.adv_log
            if "adv_dice_val" in st.session_state: del st.session_state.adv_dice_val
            st.rerun()

    # 모험 일지 로그 히스토리 렌더링
    st.divider()
    st.subheader("📜 모험 실시간 로그")
    for log in st.session_state.adv_log[:6]:
        st.write(log)


# ==========================================
# 7. 스피드 타자 게임 (Speed Typing Warrior)
# ==========================================
def typing_game_page():
    import time

    st.title("⌨️ 스피드 타자 워리어 (Speed Typing Warrior)")
    st.write("파이썬 코딩 키워드를 정확하게 빠르게 타이핑하세요! WPM과 정확도를 측정합니다.")

    # ── 단계별 문장 풀 ──────────────────────────────────────────────
    LEVELS = [
        {
            "name": "🟢 Lv.1 입문",
            "prompts": [
                "def hello",
                "print name",
                "import os",
                "x = 10",
                "if True",
                "for i in",
                "return x",
                "x = None",
                "str int",
                "list dict",
            ]
        },
        {
            "name": "🟡 Lv.2 초급",
            "prompts": [
                "def greet(name):",
                "print(hello world)",
                "import random",
                "x = range(10)",
                "if x > 0:",
                "for i in range(5):",
                "return True",
                "while True:",
                "try: except:",
                "class MyClass:",
            ]
        },
        {
            "name": "🟠 Lv.3 중급",
            "prompts": [
                "def __init__(self):",
                "st.session_state",
                "st.text_input('input')",
                "lambda x: x * 2",
                "[x for x in range(10)]",
                "dict.get(key, None)",
                "with open('file') as f:",
                "import streamlit as st",
                "st.button('클릭')",
                "random.randint(1, 100)",
            ]
        },
        {
            "name": "🔴 Lv.4 고급",
            "prompts": [
                "st.session_state['key'] = value",
                "def calculate(a, b, op='+'):",
                "{k: v for k, v in items()}",
                "st.markdown(html, unsafe_allow_html=True)",
                "class Hero(object): pass",
                "try:\n    x = int(input())\nexcept ValueError:",
                "[i**2 for i in range(1, 11)]",
                "if __name__ == '__main__':",
                "st.set_page_config(page_title='App')",
                "sorted(data, key=lambda x: x['score'], reverse=True)",
            ]
        },
        {
            "name": "💀 Lv.5 마스터",
            "prompts": [
                "from functools import reduce, partial",
                "st.columns([1, 2, 1])[1].write('center')",
                "data = {k: [v*2 for v in vals] for k, vals in raw.items()}",
                "assert isinstance(obj, dict), 'must be dict'",
                "@st.cache_data(ttl=3600)\ndef load(): pass",
                "def decorator(func):\n    def wrapper(*args):\n        return func(*args)\n    return wrapper",
                "pd.DataFrame(data).groupby('col').agg({'val': 'sum'})",
                "os.path.join(os.getcwd(), 'data', 'file.json')",
                "[(i, j) for i in range(3) for j in range(3) if i != j]",
                "asyncio.run(main())",
            ]
        }
    ]

    # ── 세션 상태 초기화 ──────────────────────────────────────────
    def init_typing_state():
        if 'ty_level' not in st.session_state:
            st.session_state.ty_level = 0
        if 'ty_prompt_idx' not in st.session_state:
            st.session_state.ty_prompt_idx = 0
        if 'ty_start_time' not in st.session_state:
            st.session_state.ty_start_time = None
        if 'ty_results' not in st.session_state:
            st.session_state.ty_results = []  # (wpm, accuracy, prompt)
        if 'ty_correct_count' not in st.session_state:
            st.session_state.ty_correct_count = 0
        if 'ty_game_phase' not in st.session_state:
            st.session_state.ty_game_phase = 'select_level'  # select_level / playing / round_result / final
        if 'ty_last_wpm' not in st.session_state:
            st.session_state.ty_last_wpm = 0
        if 'ty_last_acc' not in st.session_state:
            st.session_state.ty_last_acc = 0
        if 'ty_last_correct' not in st.session_state:
            st.session_state.ty_last_correct = False
        if 'ty_prompts_order' not in st.session_state:
            st.session_state.ty_prompts_order = list(range(10))

    init_typing_state()

    phase = st.session_state.ty_game_phase

    # ─────────────────────────────────────────────────────────────
    # 레벨 선택 화면
    # ─────────────────────────────────────────────────────────────
    if phase == 'select_level':
        st.markdown("""
        <style>
        .ty-card {
            background: linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2));
            border: 1px solid rgba(168,85,247,0.4);
            border-radius: 16px;
            padding: 24px;
            margin: 16px 0;
            text-align: center;
        }
        .ty-badge {
            display: inline-block;
            padding: 4px 14px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            margin: 4px;
        }
        </style>
        """, unsafe_allow_html=True)

        st.markdown("<div class='ty-card'><h3>⌨️ 타자 게임 방법</h3><p>단어나 코드를 정확히 타이핑하면 <b>WPM(분당 단어 수)</b>과 <b>정확도</b>가 측정됩니다.<br>각 레벨당 <b>5문장</b>을 타이핑하면 최종 점수를 받아요!</p></div>", unsafe_allow_html=True)

        st.write("### 🎯 레벨을 선택해 주세요")
        lvl_cols = st.columns(len(LEVELS))
        for i, lvl in enumerate(LEVELS):
            with lvl_cols[i]:
                if st.button(lvl['name'], key=f"ty_lvl_{i}", use_container_width=True):
                    st.session_state.ty_level = i
                    import random as _random
                    _random.shuffle(st.session_state.ty_prompts_order)
                    st.session_state.ty_prompt_idx = 0
                    st.session_state.ty_results = []
                    st.session_state.ty_correct_count = 0
                    st.session_state.ty_start_time = None
                    st.session_state.ty_game_phase = 'playing'
                    st.rerun()

        # 역대 기록 표시
        if 'ty_highscores' in st.session_state and st.session_state.ty_highscores:
            st.divider()
            st.write("### 🏆 이번 세션 최고 기록")
            for hs in st.session_state.ty_highscores[-3:]:
                st.info(f"📊 레벨: {hs['level']} | 평균 WPM: {hs['avg_wpm']} | 정확도: {hs['avg_acc']}%")

    # ─────────────────────────────────────────────────────────────
    # 게임 플레이 화면
    # ─────────────────────────────────────────────────────────────
    elif phase == 'playing':
        level = LEVELS[st.session_state.ty_level]
        prompts = level['prompts']
        total_rounds = 5
        cur_idx = st.session_state.ty_prompt_idx

        if cur_idx >= total_rounds:
            st.session_state.ty_game_phase = 'final'
            st.rerun()
            return

        prompt_pool_idx = st.session_state.ty_prompts_order[cur_idx]
        current_prompt = prompts[prompt_pool_idx % len(prompts)]

        # 진행도 표시
        st.write(f"**{level['name']}** | 문장 {cur_idx + 1} / {total_rounds}")
        st.progress((cur_idx) / total_rounds)

        # 현재 문장 표시 카드
        st.markdown(
            f"""
            <div style='background: #1e1b4b; border: 2px solid #6366f1; border-radius: 12px;
                        padding: 24px; margin: 12px 0; text-align: center;'>
                <p style='font-size: 12px; color: #c4b5fd; margin-bottom: 12px; font-weight: bold;'>📋 아래 코드를 정확히 타이핑하세요</p>
                <code style='font-size: 24px; color: #ffffff; font-family: monospace; white-space: pre; background: rgba(255,255,255,0.1); padding: 12px 20px; border-radius: 8px; display: inline-block;'>{current_prompt}</code>
            </div>
            """,
            unsafe_allow_html=True
        )

        # 입력 폼 (text_input → 엔터로 제출 가능)
        if st.session_state.ty_start_time is None:
            st.info("💡 타이핑을 시작하면 타이머가 시작됩니다! 다 입력하면 **엔터**를 누르세요 ↵")

        with st.form(key=f"ty_form_{cur_idx}", clear_on_submit=True):
            user_input = st.text_input(
                "여기에 타이핑하세요 ↓ (엔터로 제출)",
                placeholder="타이핑 후 Enter 키를 누르세요...",
                key=f"ty_input_{cur_idx}"
            )
            submitted = st.form_submit_button("✅ 제출 (또는 Enter)", use_container_width=True)

        if submitted and user_input:
            end_time = time.time()

            if st.session_state.ty_start_time is None:
                elapsed = 5.0  # 최초 클릭 시 최소 5초
            else:
                elapsed = max(0.5, end_time - st.session_state.ty_start_time)

            # 타이머 최초 입력 시작
            if st.session_state.ty_start_time is None:
                st.session_state.ty_start_time = time.time() - elapsed

            # WPM 계산 (단어 수 기준)
            word_count = len(current_prompt.split())
            wpm = round((word_count / elapsed) * 60)

            # 정확도 계산 (문자 단위)
            correct_chars = sum(
                1 for a, b in zip(user_input.strip(), current_prompt)
                if a == b
            )
            max_len = max(len(current_prompt), len(user_input.strip()))
            accuracy = round((correct_chars / max_len) * 100) if max_len > 0 else 0

            is_correct = user_input.strip() == current_prompt

            # 결과 저장
            st.session_state.ty_results.append({
                'wpm': wpm,
                'accuracy': accuracy,
                'correct': is_correct,
                'prompt': current_prompt
            })
            if is_correct:
                st.session_state.ty_correct_count += 1

            st.session_state.ty_last_wpm = wpm
            st.session_state.ty_last_acc = accuracy
            st.session_state.ty_last_correct = is_correct
            st.session_state.ty_prompt_idx += 1
            st.session_state.ty_start_time = None  # 타이머 리셋
            st.session_state.ty_game_phase = 'round_result'
            st.rerun()

        # 타이머 시작 힌트
        if st.session_state.ty_start_time is None and not submitted:
            if st.button("▶️ 타이머 시작", key="ty_timer_start"):
                st.session_state.ty_start_time = time.time()
                st.rerun()
        elif st.session_state.ty_start_time is not None:
            elapsed_now = time.time() - st.session_state.ty_start_time
            st.caption(f"⏱️ 경과 시간: {elapsed_now:.1f}초")

    # ─────────────────────────────────────────────────────────────
    # 라운드 결과 화면
    # ─────────────────────────────────────────────────────────────
    elif phase == 'round_result':
        wpm = st.session_state.ty_last_wpm
        acc = st.session_state.ty_last_acc
        correct = st.session_state.ty_last_correct
        done = st.session_state.ty_prompt_idx
        total = 5

        if correct:
            st.markdown("""
            <div style='text-align:center; font-size: 60px; animation: pulse 0.5s;'>🎉✨🔥</div>
            """, unsafe_allow_html=True)
            st.success(f"✅ 정확히 입력했습니다! WPM: **{wpm}** | 정확도: **{acc}%**")
        else:
            st.markdown("""
            <div style='text-align:center; font-size: 60px;'>⚠️</div>
            """, unsafe_allow_html=True)
            st.warning(f"⚡ 아쉽지만 오타가 있어요. WPM: **{wpm}** | 정확도: **{acc}%**")

        # WPM 속도 평가
        if wpm >= 120:
            st.info("🚀 타자 속도: **번개 급** (WPM 120+) - 전설의 코더!")
        elif wpm >= 80:
            st.info("💨 타자 속도: **고속** (WPM 80+) - 훌륭합니다!")
        elif wpm >= 50:
            st.info("👍 타자 속도: **표준** (WPM 50+) - 좋아요!")
        elif wpm >= 30:
            st.info("🐢 타자 속도: **느림** (WPM 30+) - 더 빠르게!")
        else:
            st.info("🐌 타자 속도: **초급** (WPM 30 미만) - 연습이 필요해요!")

        st.write(f"진행도: **{done} / {total}** 완료")
        st.progress(done / total)

        btn_label = "▶️ 다음 문장" if done < total else "🏁 결과 보기"
        if st.button(btn_label, key="ty_next_btn", use_container_width=True):
            if done >= total:
                st.session_state.ty_game_phase = 'final'
            else:
                st.session_state.ty_game_phase = 'playing'
            st.rerun()

    # ─────────────────────────────────────────────────────────────
    # 최종 결과 화면
    # ─────────────────────────────────────────────────────────────
    elif phase == 'final':
        results = st.session_state.ty_results
        level = LEVELS[st.session_state.ty_level]

        if not results:
            st.warning("결과 데이터가 없습니다.")
        else:
            avg_wpm = round(sum(r['wpm'] for r in results) / len(results))
            avg_acc = round(sum(r['accuracy'] for r in results) / len(results))
            correct_cnt = sum(1 for r in results if r['correct'])

            # 등급 계산
            if avg_wpm >= 100 and avg_acc >= 90:
                grade = ("🏆 SSS 랭크", "#f59e0b", "전설의 코딩 마스터!")
            elif avg_wpm >= 80 and avg_acc >= 85:
                grade = ("🥇 S 랭크", "#eab308", "탁월한 타자 실력!")
            elif avg_wpm >= 60 and avg_acc >= 80:
                grade = ("🥈 A 랭크", "#9ca3af", "우수한 속도와 정확도!")
            elif avg_wpm >= 40 and avg_acc >= 70:
                grade = ("🥉 B 랭크", "#b45309", "더 연습하면 A랭크도 금방!")
            else:
                grade = ("📚 C 랭크", "#6b7280", "꾸준히 연습해요!")

            st.markdown(
                f"""
                <div style='background: linear-gradient(135deg, rgba(99,102,241,0.3), rgba(168,85,247,0.3));
                            border: 2px solid #6366f1; border-radius: 20px; padding: 30px; text-align: center; margin: 20px 0;'>
                    <h2 style='color: #c4b5fd; margin: 0 0 8px 0;'>🎮 게임 종료!</h2>
                    <h1 style='color: {grade[1]}; margin: 0; font-size: 48px;'>{grade[0]}</h1>
                    <p style='color: #e2e8f0; font-size: 18px; margin: 8px 0 0 0;'>{grade[2]}</p>
                </div>
                """,
                unsafe_allow_html=True
            )

            # 상세 통계
            mc1, mc2, mc3, mc4 = st.columns(4)
            mc1.metric("⚡ 평균 WPM", avg_wpm)
            mc2.metric("🎯 평균 정확도", f"{avg_acc}%")
            mc3.metric("✅ 정답 문장", f"{correct_cnt} / {len(results)}")
            mc4.metric("📊 레벨", level['name'].split(' ')[1])

            st.divider()
            st.write("### 📋 문장별 상세 결과")
            for i, r in enumerate(results):
                icon = "✅" if r['correct'] else "❌"
                st.write(f"{icon} **문장 {i+1}**: `{r['prompt'][:40]}{'...' if len(r['prompt']) > 40 else ''}` | WPM: {r['wpm']} | 정확도: {r['accuracy']}%")

            # 고득점 기록 저장
            if 'ty_highscores' not in st.session_state:
                st.session_state.ty_highscores = []
            st.session_state.ty_highscores.append({
                'level': level['name'],
                'avg_wpm': avg_wpm,
                'avg_acc': avg_acc,
                'grade': grade[0]
            })

        col_a, col_b = st.columns(2)
        if col_a.button("🔄 같은 레벨 다시 도전", use_container_width=True):
            st.session_state.ty_prompt_idx = 0
            st.session_state.ty_results = []
            st.session_state.ty_correct_count = 0
            st.session_state.ty_start_time = None
            import random as _r
            _r.shuffle(st.session_state.ty_prompts_order)
            st.session_state.ty_game_phase = 'playing'
            st.rerun()
        if col_b.button("🏠 레벨 선택으로 돌아가기", use_container_width=True):
            for key in list(st.session_state.keys()):
                if key.startswith('ty_') and key != 'ty_highscores':
                    del st.session_state[key]
            st.session_state.ty_game_phase = 'select_level'
            st.rerun()


# ==========================================
# 7. 1대1 실시간 멀티 RPG 결투장 기능
# ==========================================
class MultiplayerManager:
    def __init__(self):
        self.rooms = {}  # room_id -> room_state dict

    def create_room(self, p1_name, hp, atk, def_val):
        room_id = str(random.randint(1000, 9999))
        while room_id in self.rooms:
            room_id = str(random.randint(1000, 9999))
            
        self.rooms[room_id] = {
            "p1_name": p1_name,
            "p1_hp": hp,
            "p1_max_hp": hp,
            "p1_atk": atk,
            "p1_def": def_val,
            "p1_last_action": None,
            "p1_defending": False,
            
            "p2_name": None,
            "p2_hp": None,
            "p2_max_hp": None,
            "p2_atk": None,
            "p2_def": None,
            "p2_last_action": None,
            "p2_defending": False,
            
            "turn": 1,
            "status": "waiting",
            "winner": None,
            "p1_cooldown": 0,
            "p2_cooldown": 0,
            "p1_heal_used": False,
            "p2_heal_used": False,
            "logs": ["방이 생성되었습니다. 대기 중..."],
            "version": 0
        }
        return room_id

    def join_room(self, room_id, p2_name, hp, atk, def_val):
        if room_id in self.rooms:
            room = self.rooms[room_id]
            if room["p2_name"] is None and room["status"] == "waiting":
                room["p2_name"] = p2_name
                room["p2_hp"] = hp
                room["p2_max_hp"] = hp
                room["p2_atk"] = atk
                room["p2_def"] = def_val
                room["status"] = "fighting"
                room["logs"].insert(0, f"⚔️ {p2_name}님이 입장했습니다! 결투가 시작됩니다!")
                room["version"] += 1
                return True
        return False

    def execute_action(self, room_id, player_idx, action):
        if room_id not in self.rooms:
            return False
        room = self.rooms[room_id]
        if room["status"] != "fighting":
            return False
        if room["turn"] != player_idx:
            return False
            
        p_prefix = f"p{player_idx}"
        o_prefix = "p2" if player_idx == 1 else "p1"
        
        if player_idx == 1:
            if room["p1_cooldown"] > 0:
                room["p1_cooldown"] -= 1
        else:
            if room["p2_cooldown"] > 0:
                room["p2_cooldown"] -= 1

        room[f"{p_prefix}_defending"] = False
        
        logs = []
        p_name = room[f"{p_prefix}_name"]
        o_name = room[f"{o_prefix}_name"]
        
        if action == "attack":
            dmg = max(1, room[f"{p_prefix}_atk"] - room[f"{o_prefix}_def"])
            if room[f"{o_prefix}_defending"]:
                dmg = max(1, dmg // 2)
                logs.append(f"🛡️ {o_name}님이 방어막을 켜 대미지가 절반으로 감소했습니다.")
                room[f"{o_prefix}_defending"] = False
            room[f"{o_prefix}_hp"] = max(0, room[f"{o_prefix}_hp"] - dmg)
            logs.append(f"🗡️ {p_name}님의 일반 공격! {o_name}님에게 {dmg}의 대미지를 입혔습니다.")
            
        elif action == "special":
            dmg = max(1, room[f"{p_prefix}_atk"] * 2 - int(room[f"{o_prefix}_def"] * 0.5))
            if room[f"{o_prefix}_defending"]:
                dmg = max(1, dmg // 2)
                logs.append(f"🛡️ {o_name}님이 방어막을 켜 대미지가 절반으로 감소했습니다.")
                room[f"{o_prefix}_defending"] = False
            room[f"{o_prefix}_hp"] = max(0, room[f"{o_prefix}_hp"] - dmg)
            room[f"{p_prefix}_cooldown"] = 3
            logs.append(f"💥 {p_name}님의 초강력 필살기 시전! {o_name}님에게 {dmg}의 치명적인 대미지를 입혔습니다!")
            
        elif action == "heal":
            heal_amt = int(room[f"{p_prefix}_max_hp"] * 0.5)
            room[f"{p_prefix}_hp"] = min(room[f"{p_prefix}_max_hp"], room[f"{p_prefix}_hp"] + heal_amt)
            room[f"{p_prefix}_heal_used"] = True
            logs.append(f"🧪 {p_name}님이 엘릭서 포션을 들이켰습니다! 체력을 +{heal_amt}만큼 회복했습니다.")
            
        elif action == "defend":
            room[f"{p_prefix}_defending"] = True
            logs.append(f"🛡️ {p_name}님이 방어 태세를 취했습니다. 다음 상대 턴의 대미지를 50% 경감합니다.")
            
        room[f"{p_prefix}_last_action"] = action
        
        if room[f"{o_prefix}_hp"] <= 0:
            room["status"] = "finished"
            room["winner"] = p_name
            logs.append(f"🎉 {o_name}님이 쓰러졌습니다! {p_name}님이 승리했습니다!")
        else:
            room["turn"] = 2 if player_idx == 1 else 1
            
        for log in reversed(logs):
            room["logs"].insert(0, log)
            
        room["version"] += 1
        return True

@st.cache_resource
def get_multiplayer_manager():
    return MultiplayerManager()

def multiplayer_rpg_page():
    st.title("⚔️ 1대1 실시간 멀티 RPG 결투장")
    st.write("친구와 같은 방 ID를 공유해 다른 컴퓨터에서 실시간 1대1 대결을 겨루어 보세요!")

    if "r_lvl" not in st.session_state:
        load_rpg()
    
    if "r_lvl" not in st.session_state:
        st.session_state.r_lvl = 1
        st.session_state.r_max_hp = 60
        st.session_state.r_hp = 60
        st.session_state.r_b_atk = 10
        st.session_state.r_b_def = 2
        st.session_state.r_w_atk = 0
        st.session_state.r_w_enhance = 0
        st.session_state.r_a_def = 0
        st.session_state.r_a_enhance = 0
        st.session_state.r_w_name = "낡은 나뭇가지"
        st.session_state.r_a_name = "천 옷"

    enhance_atk_bonus = st.session_state.r_w_enhance * 8
    enhance_def_bonus = st.session_state.r_a_enhance * 5
    my_atk = st.session_state.r_b_atk + st.session_state.r_w_atk + enhance_atk_bonus
    my_def = st.session_state.r_b_def + st.session_state.r_a_def + enhance_def_bonus
    my_max_hp = st.session_state.r_max_hp
    
    st.subheader("👤 나의 결투 참가자 프로필")
    mc1, mc2, mc3, mc4 = st.columns(4)
    mc1.metric("레벨", f"Lv.{st.session_state.r_lvl}")
    mc2.metric("최대 HP", f"{my_max_hp}")
    mc3.metric("공격력", f"⚔️ {my_atk}")
    mc4.metric("방어력", f"🛡️ {my_def}")
    st.caption(f"장착 장비: 무기 - {st.session_state.r_w_name}(+{st.session_state.r_w_enhance}강) | 방어구 - {st.session_state.r_a_name}(+{st.session_state.r_a_enhance}강)")

    st.divider()

    manager = get_multiplayer_manager()

    if "mr_room_id" not in st.session_state:
        st.session_state.mr_room_id = None
        st.session_state.mr_player_idx = None
        st.session_state.mr_my_name = "용사"

    if st.session_state.mr_room_id is None:
        st.subheader("🚪 결투 매칭")
        st.session_state.mr_my_name = st.text_input("닉네임을 입력하세요", value=st.session_state.mr_my_name, max_chars=12)
        
        col_create, col_join = st.columns(2)
        
        with col_create:
            st.write("#### 🆕 방 새로 만들기")
            if st.button("방 생성하고 대기하기", use_container_width=True):
                if not st.session_state.mr_my_name.strip():
                    st.error("닉네임을 입력해 주세요!")
                else:
                    room_id = manager.create_room(st.session_state.mr_my_name, my_max_hp, my_atk, my_def)
                    st.session_state.mr_room_id = room_id
                    st.session_state.mr_player_idx = 1
                    st.rerun()
                    
        with col_join:
            st.write("#### 🔑 다른 방 참가하기")
            join_room_id = st.text_input("방 번호 4자리 입력", placeholder="예: 1234")
            if st.button("방 입장하기", use_container_width=True):
                if not st.session_state.mr_my_name.strip():
                    st.error("닉네임을 입력해 주세요!")
                elif not join_room_id.strip():
                    st.error("방 번호를 정확히 입력해 주세요!")
                else:
                    success = manager.join_room(join_room_id, st.session_state.mr_my_name, my_max_hp, my_atk, my_def)
                    if success:
                        st.session_state.mr_room_id = join_room_id
                        st.session_state.mr_player_idx = 2
                        st.rerun()
                    else:
                        st.error("해당 방이 존재하지 않거나 이미 꽉 찼습니다!")
    else:
        room_id = st.session_state.mr_room_id
        if room_id not in manager.rooms:
            st.error("방이 존재하지 않거나 세션이 만료되었습니다.")
            if st.button("로비로 돌아가기"):
                st.session_state.mr_room_id = None
                st.session_state.mr_player_idx = None
                st.rerun()
            return
            
        room = manager.rooms[room_id]
        my_idx = st.session_state.mr_player_idx
        opp_idx = 2 if my_idx == 1 else 1
        
        st.success(f"🚪 매칭 방 번호: **{room_id}** (친구에게 이 번호를 공유하세요!)")
        
        if room["status"] == "waiting":
            st.warning("⚔️ 상대 플레이어가 접속하기를 기다리고 있습니다...")
            st.info("상대방이 입장하면 결투가 자동으로 시작됩니다.")
            
            if st.button("❌ 매칭 취소 및 나가기", use_container_width=True):
                if room_id in manager.rooms:
                    del manager.rooms[room_id]
                st.session_state.mr_room_id = None
                st.session_state.mr_player_idx = None
                st.rerun()
                
            @st.fragment
            def waiting_poller():
                st.write("🔄 접속 동기화 중...")
                time.sleep(2)
                cur_room = manager.rooms.get(room_id)
                if cur_room and cur_room["status"] == "fighting":
                    st.rerun()
                else:
                    st.rerun()
            
            waiting_poller()
                
        else:
            p1_active = "👉" if room["turn"] == 1 and room["status"] == "fighting" else ""
            p2_active = "👉" if room["turn"] == 2 and room["status"] == "fighting" else ""
            
            col_p1, col_vs, col_p2 = st.columns([4, 2, 4])
            
            with col_p1:
                st.markdown(f"### {p1_active} {room['p1_name']} (P1)")
                hp1 = room["p1_hp"]
                max_hp1 = room["p1_max_hp"]
                st.write(f"❤️ HP: **{hp1}** / {max_hp1}")
                st.progress(max(0.0, min(1.0, hp1 / max_hp1)))
                if room["p1_defending"]:
                    st.info("🛡️ 방어막 작동 중")
                st.caption(f"⚔️ ATK: {room['p1_atk']} | 🛡️ DEF: {room['p1_def']}")
                if room["p1_heal_used"]:
                    st.caption("🧪 포션 사용 완료")
                    
            with col_vs:
                st.markdown("<h2 style='text-align: center; margin-top: 15px;'>VS</h2>", unsafe_allow_html=True)
                
            with col_p2:
                st.markdown(f"### {p2_active} {room['p2_name']} (P2)")
                hp2 = room["p2_hp"]
                max_hp2 = room["p2_max_hp"]
                st.write(f"❤️ HP: **{hp2}** / {max_hp2}")
                st.progress(max(0.0, min(1.0, hp2 / max_hp2)))
                if room["p2_defending"]:
                    st.info("🛡️ 방어막 작동 중")
                st.caption(f"⚔️ ATK: {room['p2_atk']} | 🛡️ DEF: {room['p2_def']}")
                if room["p2_heal_used"]:
                    st.caption("🧪 포션 사용 완료")
            
            st.divider()
            
            if room["status"] == "finished":
                st.balloons()
                st.success(f"🎉 **결투 종료!** 승리자: **{room['winner']}**")
                if st.button("🚪 로비로 나가기", use_container_width=True):
                    if room_id in manager.rooms:
                        del manager.rooms[room_id]
                    st.session_state.mr_room_id = None
                    st.session_state.mr_player_idx = None
                    st.rerun()
                return

            my_turn = (room["turn"] == my_idx)
            
            if my_turn:
                st.info("🟢 **당신의 차례입니다!** 행동을 선택하세요.")
                
                cd_val = room[f"p{my_idx}_cooldown"]
                spec_label = "💥 필살기 (3턴 쿨)" if cd_val == 0 else f"💥 필살기 ({cd_val}턴 대기)"
                spec_disabled = cd_val > 0
                
                potion_used = room[f"p{my_idx}_heal_used"]
                potion_disabled = potion_used
                
                act_cols = st.columns(4)
                
                if act_cols[0].button("🗡️ 일반 공격", use_container_width=True):
                    manager.execute_action(room_id, my_idx, "attack")
                    st.rerun()
                    
                if act_cols[1].button(spec_label, disabled=spec_disabled, use_container_width=True):
                    manager.execute_action(room_id, my_idx, "special")
                    st.rerun()
                    
                if act_cols[2].button("🛡️ 방어 태세", use_container_width=True):
                    manager.execute_action(room_id, my_idx, "defend")
                    st.rerun()
                    
                if act_cols[3].button("🧪 엘릭서 포션 회복", disabled=potion_disabled, use_container_width=True):
                    manager.execute_action(room_id, my_idx, "heal")
                    st.rerun()
            else:
                st.warning(f"🔴 **상대방({room[f'p{opp_idx}_name']})의 턴입니다.** 대기 중...")
                
                @st.fragment
                def game_poller():
                    st.write("🔄 상대방의 결정을 기다리는 중...")
                    init_version = room["version"]
                    time.sleep(2)
                    cur_room = manager.rooms.get(room_id)
                    if cur_room and cur_room["version"] != init_version:
                        st.rerun()
                    else:
                        st.rerun()
                
                game_poller()
                
            st.divider()
            st.write("### 📜 전투 상황 로그")
            for log in room["logs"][:10]:
                st.write(log)
            
            if st.button("🏳️ 항복하고 방 나가기", use_container_width=True):
                room["status"] = "finished"
                room["winner"] = room[f"p{opp_idx}_name"]
                room["logs"].insert(0, f"🏳️ {room[f'p{my_idx}_name']}님이 항복을 선언했습니다.")
                room["version"] += 1
                st.session_state.mr_room_id = None
                st.session_state.mr_player_idx = None
                st.rerun()


# ==========================================
# 7-2. 드래곤 보육원 & 배틀 RPG (React 임베드)
# ==========================================
DRAGON_GAME_HTML = r'''<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<script src="https://cdn.tailwindcss.com"></script>
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script>
  // preset-react 기본값(automatic 런타임)은 UMD 환경에서 import 구문을 생성해
  // "Cannot use import statement outside a module" 오류로 화면이 검게 나온다.
  // classic 런타임(React.createElement)으로 강제하는 커스텀 프리셋을 등록한다.
  Babel.registerPreset('classic-react', {
    presets: [[Babel.availablePresets['react'], { runtime: 'classic' }]]
  });
</script>
<script type="module">
  // Trystero: 계정/서버 없이 브라우저끼리 직접 연결(P2P)하는 라이브러리.
  // 온라인 대전(다른 기기) 기능에서 방 코드로 두 브라우저를 연결하는 데 사용한다.
  import { joinRoom } from 'https://esm.run/@trystero-p2p/torrent';
  window.__trystero = { joinRoom };
  window.dispatchEvent(new Event('trystero-ready'));
</script>
<style>
  html,body{margin:0;padding:0;background:#0b1020;overflow-x:hidden;}
  #root{min-height:100vh;}
  .bar{height:8px;border-radius:9999px;overflow:hidden;background:#1f2937;}
  .bar > div{height:100%;transition:width .3s ease;}
  /* ===== 공격 이펙트 레이어 & 파티클 ===== */
  .fx-layer{position:absolute;inset:0;pointer-events:none;overflow:visible;z-index:40;}
  .fx-node{position:absolute;pointer-events:none;will-change:transform,opacity;z-index:40;
           transform:translate(-50%,-50%);display:flex;align-items:center;justify-content:center;}
  /* 중심 정렬(translate -50%,-50%) 기반 키프레임 */
  @keyframes fxProj{0%{transform:translate(-50%,-50%) scale(var(--s0,.7))}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(var(--s1,1));opacity:1}}
  @keyframes fxTrail{0%{transform:translate(-50%,-50%) scale(1);opacity:.85}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(.3);opacity:0}}
  @keyframes fxBreath{0%{transform:translate(-50%,-50%) scale(.2);opacity:0}30%{opacity:1}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(1.5);opacity:0}}
  @keyframes fxBurst{0%{transform:translate(-50%,-50%) scale(.3);opacity:1}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(.6);opacity:0}}
  @keyframes fxSuck{0%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(1.1);opacity:0}25%{opacity:1}100%{transform:translate(-50%,-50%) scale(.1);opacity:0}}
  @keyframes fxSpiral{0%{transform:translate(-50%,-50%) rotate(0) scale(.5)}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) rotate(900deg) scale(1.1);opacity:.6}}
  @keyframes fxMeteor{0%{transform:translate(-50%,-50%) rotate(45deg) scale(.7);opacity:1}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) rotate(45deg) scale(1.15);opacity:1}}
  @keyframes fxRipple{0%{transform:translate(-50%,-50%) scale(.2);opacity:.9}100%{transform:translate(-50%,-50%) scale(2.6);opacity:0}}
  @keyframes fxRipple2{0%{transform:translate(-50%,-50%) scale(.4);opacity:.8}100%{transform:translate(-50%,-50%) scale(1.7);opacity:0}}
  @keyframes fxFlash{0%{transform:translate(-50%,-50%) scale(.2);opacity:.95}100%{transform:translate(-50%,-50%) scale(2.2);opacity:0}}
  @keyframes fxImplode{0%{transform:translate(-50%,-50%) scale(.2);opacity:0}40%{transform:translate(-50%,-50%) scale(1.8);opacity:1}100%{transform:translate(-50%,-50%) scale(0);opacity:.9}}
  @keyframes fxRune{0%{transform:translate(-50%,-50%) rotate(0) scale(0);opacity:0}30%{opacity:1;transform:translate(-50%,-50%) rotate(140deg) scale(1)}100%{transform:translate(-50%,-50%) rotate(380deg) scale(1.35);opacity:0}}
  @keyframes fxPop{0%{transform:translate(-50%,-50%) scale(0);opacity:1}60%{transform:translate(-50%,-50%) scale(1.35)}100%{transform:translate(-50%,-50%) scale(1);opacity:0}}
  @keyframes fxSlash{0%{transform:translate(-50%,-50%) rotate(var(--ang)) scaleX(0);opacity:0}30%{opacity:1;transform:translate(-50%,-50%) rotate(var(--ang)) scaleX(1)}100%{opacity:0;transform:translate(-50%,-50%) rotate(var(--ang)) scaleX(1.15)}}
  @keyframes fxSpin{0%{transform:translate(-50%,-50%) rotate(0) scale(.3);opacity:0}30%{opacity:1}100%{transform:translate(-50%,-50%) rotate(360deg) scale(1.4);opacity:0}}
  /* 좌측 기준(빔) */
  @keyframes fxBeam{0%{transform:rotate(var(--ang)) scaleX(0);opacity:0}20%{opacity:1}80%{opacity:1}100%{transform:rotate(var(--ang)) scaleX(1);opacity:0}}
  /* 상단 기준(빛기둥) */
  @keyframes fxPillar{0%{transform:translateX(-50%) scaleY(0);opacity:0}30%{transform:translateX(-50%) scaleY(1);opacity:1}80%{opacity:1}100%{transform:translateX(-50%) scaleY(1);opacity:0}}
  /* 곡선 투사체: --mx/--my 중간점 경유 */
  @keyframes fxCurve{0%{transform:translate(-50%,-50%) scale(var(--s0,.7));opacity:1}50%{transform:translate(calc(-50% + var(--mx)),calc(-50% + var(--my))) scale(1.05)}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(var(--s1,1));opacity:1}}
  /* 바닥 고정 성장(넝쿨/물기둥): origin bottom */
  @keyframes fxVine{0%{transform:translate(-50%,-100%) scaleY(0);opacity:0}25%{opacity:1}70%{transform:translate(-50%,-100%) scaleY(1.06)}85%{transform:translate(-50%,-100%) scaleY(.98);opacity:1}100%{transform:translate(-50%,-100%) scaleY(1);opacity:0}}
  /* 중력 낙하(파편) */
  @keyframes fxGravity{0%{transform:translate(-50%,-50%);opacity:1}60%{opacity:1}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy)));opacity:0}}
  /* 위로 떠오르며 소멸(불티/치유) */
  @keyframes fxFloat{0%{transform:translate(-50%,-50%) scale(1);opacity:0}20%{opacity:1}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% - var(--dy))) scale(.5);opacity:0}}
  /* 제자리 깜빡임(경고 링/잔불) */
  @keyframes fxBlink{0%,100%{opacity:0}20%,80%{opacity:.9}50%{opacity:.4}}
  /* 그림자 확대(운석 예고) */
  @keyframes fxShadow{0%{transform:translate(-50%,-50%) scale(.15);opacity:0}30%{opacity:.55}100%{transform:translate(-50%,-50%) scale(1);opacity:.75}}
  /* 강력 진동 */
  .quake{animation:quake .5s;}
  @keyframes quake{0%,100%{transform:translate(0,0)}15%{transform:translate(-7px,3px) rotate(-1deg)}35%{transform:translate(6px,-4px) rotate(1deg)}55%{transform:translate(-5px,-3px)}75%{transform:translate(4px,3px) rotate(.5deg)}}
  /* 데미지 숫자 부양 */
  @keyframes fxDmg{0%{transform:translate(-50%,-50%) scale(.5);opacity:0}18%{transform:translate(-50%,-95%) scale(1.25);opacity:1}45%{transform:translate(-50%,-130%) scale(1)}100%{transform:translate(-50%,-210%) scale(.95);opacity:0}}
  /* 전면 섬광(임팩트 프레임) */
  @keyframes fxScreen{0%{opacity:0}25%{opacity:var(--fo,.55)}100%{opacity:0}}
  /* 각성 오라 맥동 */
  .awk-pulse{animation:awkPulse 1.8s ease-in-out infinite alternate;}
  @keyframes awkPulse{from{filter:drop-shadow(0 0 3px rgba(251,191,36,.5))}to{filter:drop-shadow(0 0 12px rgba(251,191,36,.95))}}
  /* SVG 드래곤 미세 부유 */
  .drg-float{animation:drgFloat 2.6s ease-in-out infinite alternate;}
  @keyframes drgFloat{from{transform:translateY(0)}to{transform:translateY(-3px)}}
  .glow{animation:glow 1.6s ease-in-out infinite alternate;}
  @keyframes glow{from{filter:drop-shadow(0 0 2px rgba(255,255,255,.2));}to{filter:drop-shadow(0 0 10px rgba(255,255,255,.55));}}
  .shake{animation:shake .4s;}
  @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
  .fade{animation:fade .3s ease;}
  @keyframes fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  .chip{transition:transform .12s;}
  .chip:hover{transform:translateY(-2px);}
  ::-webkit-scrollbar{width:10px;height:10px}::-webkit-scrollbar-thumb{background:#334155;border-radius:8px}
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel" data-presets="classic-react">
const { useState, useEffect, useRef } = React;

/* ============ 코어 데이터 ============ */
const ELEMENTS = {
  fire:   { name:"불",   emoji:"🔥", color:"#ef4444" },
  water:  { name:"물",   emoji:"💧", color:"#3b82f6" },
  forest: { name:"숲",   emoji:"🌿", color:"#22c55e" },
  metal:  { name:"금속", emoji:"⚙️", color:"#9ca3af" },
  wind:   { name:"바람", emoji:"🌪️", color:"#38bdf8" },
  void:   { name:"공허", emoji:"🌌", color:"#a855f7" },
  holy:   { name:"신성", emoji:"✨", color:"#eab308" },
  ancient:{ name:"고대", emoji:"🏛️", color:"#b45309" },
  earth:  { name:"대지", emoji:"🪨", color:"#92400e" },
};
const ELEM_KEYS = Object.keys(ELEMENTS);
const ADV = {
  fire:["forest","metal"], water:["fire","earth"], forest:["water","wind"],
  metal:["forest","void"], wind:["metal","earth"], void:["holy","ancient"],
  holy:["void","earth"], ancient:["metal","wind"], earth:["fire","forest"],
};
const GRADES = {
  common:    { name:"일반", count:1, color:"#9ca3af", hp:110, atk:16 },
  rare:      { name:"희귀", count:2, color:"#3b82f6", hp:180, atk:27 },
  epic:      { name:"에픽", count:3, color:"#a855f7", hp:270, atk:42 },
  legendary: { name:"전설", count:4, color:"#eab308", hp:390, atk:62 },
};
const gradeByCount = c => c>=4?"legendary":c===3?"epic":c===2?"rare":"common";

/* ============ 유틸 ============ */
let _id = 1; const uid = () => _id++;
const rand = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
const pick = arr => arr[Math.floor(Math.random()*arr.length)];
const sample = (arr,n) => { const c=[...arr], o=[]; while(o.length<n && c.length){ o.push(c.splice(Math.floor(Math.random()*c.length),1)[0]); } return o; };
const uniq = arr => Array.from(new Set(arr));

/* ============ 저장 (localStorage + 이동용 코드) ============ */
const SAVE_KEY = "yunny_dragon_save_v1";
function loadSave(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return null;
    const obj = JSON.parse(raw);
    if(obj && Array.isArray(obj.dragons)) return obj;
  }catch(e){}
  return null;
}
function saveLocal(payload){
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify(payload)); }catch(e){}
}
function encodeSave(obj){
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  bytes.forEach(b=>{ bin += String.fromCharCode(b); });
  return btoa(bin);
}
function decodeSave(code){
  const bin = atob(code.trim());
  const bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
  const json = new TextDecoder().decode(bytes);
  const obj = JSON.parse(json);
  if(!obj || !Array.isArray(obj.dragons)) throw new Error("invalid save");
  return obj;
}
function ensureTrystero(cb){
  if(window.__trystero){ cb(window.__trystero); return; }
  const handler = ()=>{ window.removeEventListener("trystero-ready", handler); cb(window.__trystero); };
  window.addEventListener("trystero-ready", handler);
}

/* ============ 종족(종=속성 고정) 시스템 ============
   등급당 10종, 총 40종. 각 종은 속성이 영구 고정 — 같은 종이면 언제나 같은 속성.
   드래곤은 종 id(sid)를 가지며, 이름·속성·외형이 모두 종에서 결정된다. */
function canonElems(elements){ return ELEM_KEYS.filter(k=>elements.includes(k)); }
const SPECIES = [
  // ---- 일반 (속성 1) ----
  { sid:"c01", name:"이그니스",     grade:"common", elems:["fire"] },
  { sid:"c02", name:"엠버링",       grade:"common", elems:["fire"] },
  { sid:"c03", name:"아쿠아리스",   grade:"common", elems:["water"] },
  { sid:"c04", name:"베르단트",     grade:"common", elems:["forest"] },
  { sid:"c05", name:"크롬하르트",   grade:"common", elems:["metal"] },
  { sid:"c06", name:"제피로스",     grade:"common", elems:["wind"] },
  { sid:"c07", name:"녹티스",       grade:"common", elems:["void"] },
  { sid:"c08", name:"세라피엘",     grade:"common", elems:["holy"] },
  { sid:"c09", name:"안티쿠스",     grade:"common", elems:["ancient"] },
  { sid:"c10", name:"테라곤",       grade:"common", elems:["earth"] },
  // ---- 희귀 (속성 2) ----
  { sid:"r01", name:"스콜치윙",     grade:"rare", elems:["fire","wind"] },
  { sid:"r02", name:"마그마룬",     grade:"rare", elems:["fire","earth"] },
  { sid:"r03", name:"리버룬",       grade:"rare", elems:["water","forest"] },
  { sid:"r04", name:"스톰서지",     grade:"rare", elems:["water","wind"] },
  { sid:"r05", name:"루미나흐",     grade:"rare", elems:["water","holy"] },
  { sid:"r06", name:"블룸세라",     grade:"rare", elems:["forest","holy"] },
  { sid:"r07", name:"아이언스케일", grade:"rare", elems:["metal","earth"] },
  { sid:"r08", name:"옵시디언팽",   grade:"rare", elems:["metal","void"] },
  { sid:"r09", name:"섀도게일",     grade:"rare", elems:["wind","void"] },
  { sid:"r10", name:"렐릭혼",       grade:"rare", elems:["ancient","earth"] },
  // ---- 에픽 (속성 3) ----
  { sid:"e01", name:"인페르노게일", grade:"epic", elems:["fire","wind","void"] },
  { sid:"e02", name:"볼케인아머",   grade:"epic", elems:["fire","metal","earth"] },
  { sid:"e03", name:"이클립스번",   grade:"epic", elems:["fire","void","holy"] },
  { sid:"e04", name:"아쿠아블룸",   grade:"epic", elems:["water","forest","holy"] },
  { sid:"e05", name:"어비스스톰",   grade:"epic", elems:["water","wind","void"] },
  { sid:"e06", name:"테라블룸",     grade:"epic", elems:["water","forest","earth"] },
  { sid:"e07", name:"실버리프",     grade:"epic", elems:["forest","metal","wind"] },
  { sid:"e08", name:"스카이렐릭",   grade:"epic", elems:["wind","holy","ancient"] },
  { sid:"e09", name:"가이아포지",   grade:"epic", elems:["metal","ancient","earth"] },
  { sid:"e10", name:"룬셰이드",     grade:"epic", elems:["void","ancient","earth"] },
  // ---- 전설 (속성 4) ----
  { sid:"l01", name:"카오스레인",   grade:"legendary", elems:["fire","water","wind","void"] },
  { sid:"l02", name:"솔라리스렉스", grade:"legendary", elems:["fire","holy","ancient","earth"] },
  { sid:"l03", name:"에테르블룸",   grade:"legendary", elems:["water","forest","wind","holy"] },
  { sid:"l04", name:"녹스가이아",   grade:"legendary", elems:["metal","void","ancient","earth"] },
  { sid:"l05", name:"이그드라온",   grade:"legendary", elems:["fire","forest","ancient","earth"] },
  { sid:"l06", name:"프리즘세일",   grade:"legendary", elems:["water","metal","wind","holy"] },
  { sid:"l07", name:"아스트랄룬",   grade:"legendary", elems:["wind","void","holy","ancient"] },
  { sid:"l08", name:"헬포지",       grade:"legendary", elems:["fire","water","metal","void"] },
  { sid:"l09", name:"가이아셀레스트", grade:"legendary", elems:["forest","wind","holy","earth"] },
  { sid:"l10", name:"오리진플레어", grade:"legendary", elems:["fire","void","holy","ancient"] },
];
const SPECIES_BY_ID = {}; SPECIES.forEach(s=>{ SPECIES_BY_ID[s.sid]=s; });
const SPECIES_BY_GRADE = { common:[], rare:[], epic:[], legendary:[] };
SPECIES.forEach(s=>SPECIES_BY_GRADE[s.grade].push(s));
// 종 내 변형 인덱스(뿔·가시 모양 차이용)
function speciesVariant(sid){ return parseInt(sid.slice(1),10)-1; }

// 속성 집합 → 가장 잘 맞는 종 찾기 (같은 등급에서 겹치는 속성 최다 → 동률이면 랜덤)
function resolveSpecies(elements, grade){
  const el = canonElems(elements);
  const pool = SPECIES_BY_GRADE[grade] || SPECIES_BY_GRADE.common;
  const exact = pool.filter(s=> s.elems.length===el.length && s.elems.every(e=>el.includes(e)));
  if(exact.length) return pick(exact);
  let best=-1, cands=[];
  pool.forEach(s=>{ const ov=s.elems.filter(e=>el.includes(e)).length;
    if(ov>best){ best=ov; cands=[s]; } else if(ov===best) cands.push(s); });
  return pick(cands);
}

function makeDragonFromSpecies(sp, grown){
  const g = GRADES[sp.grade];
  const maxHp = g.hp + rand(-8,24);
  return { id:uid(), sid:sp.sid, name:sp.name, grade:sp.grade, elements:[...sp.elems],
           maxHp, hp:maxHp, atk:g.atk+rand(-3,6),
           growth: grown ? 100 : 0, fullness: grown ? 75 : 45 };
}
function makeDragon(grade, elements, grown){
  return makeDragonFromSpecies(resolveSpecies(elements, grade), grown);
}
function randomDragon(grade, mult){
  const d = makeDragonFromSpecies(pick(SPECIES_BY_GRADE[grade]), true);
  if(mult && mult!==1){ d.maxHp=Math.round(d.maxHp*mult); d.hp=d.maxHp; d.atk=Math.round(d.atk*mult); }
  return d;
}
// 구버전 저장 호환: sid 없는 드래곤/알에 종을 배정하고 이름을 종명으로 통일
function migrateDragon(d){
  if(d.sid && SPECIES_BY_ID[d.sid]) return d;
  const sp = resolveSpecies(d.elements||[], d.grade||"common");
  return {...d, sid:sp.sid, name:sp.name, elements:[...sp.elems]};
}
function migrateEgg(e){
  if(e.sid && SPECIES_BY_ID[e.sid]) return e;
  const grade = e.grade || "common";
  const sp = resolveSpecies(e.elements||[], grade);
  return {...e, sid:sp.sid, elements:[...sp.elems]};
}
function calcDamage(atkVal, atkElem, defElems){
  let mult = 1;
  if(ADV[atkElem] && ADV[atkElem].some(e=>defElems.includes(e))) mult = 1.5;
  const base = atkVal * (0.85 + Math.random()*0.35);
  return { dmg: Math.max(1, Math.round(base*mult)), mult };
}

/* ============ 공격 이펙트(파티클) 시스템 ============ */
// 하나의 DOM 파티클을 fx 레이어에 붙이고, 수명이 지나면 자동 제거한다.
function fxNode(fx, opt){
  const e = document.createElement("div");
  e.className = "fx-node";
  if(opt.style) Object.assign(e.style, opt.style);
  if(opt.left!=null) e.style.left = opt.left+"px";
  if(opt.top!=null)  e.style.top  = opt.top+"px";
  if(opt.dx!=null)  e.style.setProperty("--dx", opt.dx+"px");
  if(opt.dy!=null)  e.style.setProperty("--dy", opt.dy+"px");
  if(opt.mx!=null)  e.style.setProperty("--mx", opt.mx+"px");
  if(opt.my!=null)  e.style.setProperty("--my", opt.my+"px");
  if(opt.ang!=null) e.style.setProperty("--ang", opt.ang+"rad");
  if(opt.origin) e.style.transformOrigin = opt.origin;
  if(opt.anim) e.style.animation = opt.anim;
  if(opt.text!=null) e.textContent = opt.text;
  fx.appendChild(e);
  setTimeout(()=>{ try{ e.remove(); }catch(_){} }, opt.life||1000);
  return e;
}
const RAD = Math.PI/180;
function circle(size, c1, c2){
  return { width:size+"px", height:size+"px", borderRadius:"50%",
    background:"radial-gradient(circle at 35% 30%, "+c1+", "+c2+")", boxShadow:"0 0 14px "+c2 };
}
function ring(size, color, w){
  return { width:size+"px", height:size+"px", borderRadius:"50%",
    border:(w||4)+"px solid "+color, boxShadow:"0 0 16px "+color+", inset 0 0 12px "+color };
}
function emojiStyle(px, glow){ return { fontSize:(px||28)+"px", filter:"drop-shadow(0 0 8px "+(glow||"rgba(255,255,255,.6)")+")" }; }

/* ---- 연출 툴킷 ---- */
// 지연 실행(수명 자동 정리용으로 setTimeout 그대로 사용)
function after(ms, f){ setTimeout(f, ms); }
// 방사형 스파크
function sparks(fx,x,y,color,n,dist,delay,size){
  for(let i=0;i<n;i++){ const a=(i/n)*360*RAD+Math.random()*0.4, d=dist*(0.7+Math.random()*0.6);
    fxNode(fx,{left:x,top:y,dx:Math.cos(a)*d,dy:Math.sin(a)*d,style:circle(size||9,"#fff",color),
      anim:"fxBurst .55s ease-out "+(delay||0)+"ms forwards",life:(delay||0)+700}); }
}
// 충격파 링(이중)
function shockwave(fx,x,y,color,delay){
  fxNode(fx,{left:x,top:y,style:ring(60,color,4),anim:"fxRipple .55s ease-out "+(delay||0)+"ms forwards",life:(delay||0)+700});
  fxNode(fx,{left:x,top:y,style:ring(40,"#ffffff",2),anim:"fxRipple2 .5s ease-out "+((delay||0)+60)+"ms forwards",life:(delay||0)+700});
}
// 섬광
function flashAt(fx,x,y,color,size,delay){
  fxNode(fx,{left:x,top:y,style:{width:size+"px",height:size+"px",borderRadius:"50%",
    background:"radial-gradient(circle,#fff,"+color+"00)"},anim:"fxFlash .45s ease-out "+(delay||0)+"ms forwards",life:(delay||0)+600});
}
// 시전자 주변 기 모으기(입자 수렴)
function converge(fx,x,y,color,n,delay){
  for(let i=0;i<(n||8);i++){ const a=(i/(n||8))*360*RAD, d=40+Math.random()*26;
    fxNode(fx,{left:x,top:y,dx:Math.cos(a)*d,dy:Math.sin(a)*d,style:circle(8,"#fff",color),
      anim:"fxSuck .38s ease-in "+((delay||0)+i*18)+"ms forwards",life:(delay||0)+i*18+520}); }
}
// 두 점 사이 빔 (세로 중앙 보정 포함 — 기존 높이/2 오프셋 버그 수정)
function beamLine(fx,ax,ay,tx,ty,h,cssBg,glow,delay,durMs){
  const ang=Math.atan2(ty-ay,tx-ax), dist=Math.hypot(tx-ax,ty-ay);
  fxNode(fx,{left:ax,top:ay,ang,origin:"left center",
    style:{width:dist+"px",height:h+"px",marginTop:(-h/2)+"px",background:cssBg,
           boxShadow:"0 0 18px "+glow,borderRadius:(h/2)+"px"},
    anim:"fxBeam "+((durMs||500)/1000)+"s ease-out "+(delay||0)+"ms forwards",life:(delay||0)+(durMs||500)+150});
}
// 경로 위 점 잔상
function lineDots(fx,ax,ay,tx,ty,n,styleFn,animName,stagger,delay){
  for(let i=0;i<n;i++){ const f=(i+1)/(n+1);
    fxNode(fx,{left:ax+(tx-ax)*f,top:ay+(ty-ay)*f,dx:0,dy:0,style:styleFn(i),
      anim:animName+" .45s ease-out "+((delay||0)+i*(stagger||24))+"ms forwards",life:(delay||0)+i*(stagger||24)+600}); }
}
// 바닥에서 자라는 기둥(넝쿨/물기둥/토네이도 축)
function pillarUp(fx,x,groundY,w,hgt,cssBg,glow,delay,durMs){
  fxNode(fx,{left:x,top:groundY,origin:"bottom center",
    style:{width:w+"px",height:hgt+"px",background:cssBg,boxShadow:"0 0 16px "+glow,borderRadius:(w/2)+"px"},
    anim:"fxVine "+((durMs||600)/1000)+"s ease-out "+(delay||0)+"ms forwards",life:(delay||0)+(durMs||600)+150});
}
// 중력 파편(포물선 낙하 근사)
function debrisArc(fx,x,y,color,n,delay){
  for(let i=0;i<n;i++){ const a=(-30-Math.random()*120)*RAD, sp=40+Math.random()*46;
    fxNode(fx,{left:x,top:y,dx:Math.cos(a)*sp*(Math.random()<.5?-1:1),dy:Math.abs(Math.sin(a))*sp+50,
      style:circle(7+Math.random()*8,"#e7e5e4",color),
      anim:"fxGravity .7s cubic-bezier(.3,0,.8,1) "+((delay||0)+i*20)+"ms forwards",life:(delay||0)+i*20+850}); }
}
// 위로 떠오르는 입자(불티/치유광)
function floatUp(fx,x,y,color,n,delay,emoji){
  for(let i=0;i<n;i++){ const dx=(Math.random()-0.5)*56, dy=42+Math.random()*46;
    fxNode(fx,{left:x,top:y,dx,dy,style: emoji?emojiStyle(13+Math.random()*8,color):circle(7,"#fff",color),
      text: emoji||null, anim:"fxFloat .8s ease-out "+((delay||0)+i*30)+"ms forwards",life:(delay||0)+i*30+950}); }
}
// 표적 지점의 공통 충격(고리 + 섬광 + 스파크)
function impactBurst(fx, tx, ty, c1, c2, delay){
  shockwave(fx,tx,ty,c1,delay||0);
  flashAt(fx,tx,ty,c2,50,(delay||0));
  sparks(fx,tx,ty,c2,8,44,(delay||0),9);
}

// 10종 공격 모션 정의. build(fx, ax, ay, tx, ty, color)
const ATTACK_FX = {
  /* 1) 불 — 화염 브레스: 불티 수렴 → 3중 화염 분사 + 화염핵 빔 → 폭염, 잔불이 위로 피어오름 */
  fire: { name:"화염 브레스", impact:560, dur:1000, build(fx,ax,ay,tx,ty){
    const ang=Math.atan2(ty-ay,tx-ax), dist=Math.hypot(tx-ax,ty-ay);
    converge(fx,ax,ay,"#f97316",8,0);
    flashAt(fx,ax,ay,"#f97316",42,120);
    for(let w=0;w<3;w++) for(let i=0;i<8;i++){
      const sp=(Math.random()-0.5)*(0.62-w*0.14), d=dist*(0.5+w*0.24+Math.random()*0.2);
      fxNode(fx,{left:ax,top:ay,dx:Math.cos(ang+sp)*d,dy:Math.sin(ang+sp)*d,
        style:circle(12+Math.random()*16, w?"#fed7aa":"#fff7ed", i%2?"#f97316":"#ef4444"),
        anim:"fxBreath "+(0.42+w*0.08)+"s ease-out "+(180+w*90+i*16)+"ms forwards",life:1050});
    }
    beamLine(fx,ax,ay,tx,ty,14,"linear-gradient(90deg,#fff7ed,#fb923c,#ef4444)","#f97316",240,420);
    after(540,()=>{
      impactBurst(fx,tx,ty,"#f97316","#ef4444");
      floatUp(fx,tx,ty,"#fb923c",7,80,"🔥");
      for(let i=0;i<3;i++) fxNode(fx,{left:tx+(i-1)*22,top:ty+10,style:emojiStyle(15,"#f97316"),text:"🔥",
        anim:"fxBlink .5s ease-out "+(150+i*90)+"ms forwards",life:900});
    });
  }},
  /* 2) 물 — 격류포: 물방울 수렴·수구 팽창 → 포물선 수구 + 낙하 물방울 궤적 → 물기둥 + 겹물결 + 낙수 */
  water: { name:"격류포", impact:580, dur:1050, build(fx,ax,ay,tx,ty){
    converge(fx,ax,ay,"#3b82f6",9,0);
    fxNode(fx,{left:ax,top:ay,style:circle(34,"#dbeafe","#2563eb"),anim:"fxPop .3s ease-out forwards",life:380});
    const midX=(tx-ax)/2, midY=(ty-ay)/2-46;
    fxNode(fx,{left:ax,top:ay,dx:tx-ax,dy:ty-ay,mx:midX,my:midY,style:circle(30,"#eff6ff","#2563eb"),
      anim:"fxCurve .42s ease-in 200ms forwards",life:720});
    for(let i=0;i<8;i++){ const f=(i+1)/9;
      fxNode(fx,{left:ax+(tx-ax)*f,top:ay+(ty-ay)*f-40*Math.sin(f*Math.PI),dx:(Math.random()-0.5)*20,dy:34+Math.random()*26,
        style:circle(8+Math.random()*6,"#eff6ff","#3b82f6"),
        anim:"fxGravity .5s cubic-bezier(.3,0,.8,1) "+(240+i*26)+"ms forwards",life:240+i*26+650}); }
    after(560,()=>{
      pillarUp(fx,tx,ty+22,26,96,"linear-gradient(#eff6ff,#60a5fa,#1d4ed8)","#3b82f6",0,520);
      shockwave(fx,tx,ty,"#60a5fa",0); shockwave(fx,tx,ty,"#3b82f6",130);
      for(let i=0;i<8;i++){ const a=(-160+i*20)*RAD;
        fxNode(fx,{left:tx,top:ty,dx:Math.cos(a)*46,dy:Math.abs(Math.sin(a))*30+56,style:circle(8,"#eff6ff","#2563eb"),
          anim:"fxGravity .6s cubic-bezier(.3,0,.8,1) "+(i*22)+"ms forwards",life:i*22+750}); }
    });
  }},
  /* 3) 숲 — 가시 넝쿨: 잎 소용돌이 → 씨앗 포물선 → 넝쿨 3줄기 융기 + 가시 방사 + 꽃잎 낙하 */
  forest: { name:"가시 넝쿨", impact:560, dur:1080, build(fx,ax,ay,tx,ty){
    for(let i=0;i<6;i++){ const a=i*60*RAD;
      fxNode(fx,{left:ax+Math.cos(a)*26,top:ay+Math.sin(a)*26,style:emojiStyle(15,"#22c55e"),text:"🍃",
        anim:"fxSuck .4s ease-in "+(i*24)+"ms forwards",life:i*24+540}); }
    fxNode(fx,{left:ax,top:ay,dx:tx-ax,dy:ty-ay,mx:(tx-ax)/2,my:(ty-ay)/2-56,style:emojiStyle(20,"#22c55e"),text:"🌰",
      anim:"fxCurve .4s ease-in 170ms forwards",life:660});
    after(540,()=>{
      pillarUp(fx,tx,ty+24,10,86,"linear-gradient(#bbf7d0,#16a34a,#14532d)","#22c55e",0,560);
      pillarUp(fx,tx-20,ty+24,8,64,"linear-gradient(#bbf7d0,#15803d)","#16a34a",90,520);
      pillarUp(fx,tx+20,ty+24,8,70,"linear-gradient(#bbf7d0,#15803d)","#16a34a",150,520);
      for(let i=0;i<10;i++){ const a=i*36*RAD, d=32+Math.random()*26;
        fxNode(fx,{left:tx,top:ty,dx:Math.cos(a)*d,dy:Math.sin(a)*d,ang:a+90*RAD,
          style:{width:"5px",height:"22px",background:"linear-gradient(#bbf7d0,#15803d)",borderRadius:"3px",boxShadow:"0 0 8px #22c55e"},
          anim:"fxBurst .5s ease-out "+(60+i*14)+"ms forwards",life:800}); }
      impactBurst(fx,tx,ty,"#22c55e","#15803d",60);
      for(let i=0;i<5;i++) fxNode(fx,{left:tx+(Math.random()-0.5)*60,top:ty-30,dx:(Math.random()-0.5)*30,dy:52,
        style:emojiStyle(13,"#4ade80"),text:"🌸",anim:"fxGravity .8s ease-in "+(180+i*60)+"ms forwards",life:180+i*60+950});
    });
  }},
  /* 4) 금속 — 강철 난도: 대장간 스파크·부채꼴 칼날 소환 → 순차 발사(회전 정렬) → X자 절단 + 파편 */
  metal: { name:"강철 난도", impact:520, dur:950, build(fx,ax,ay,tx,ty){
    const ang=Math.atan2(ty-ay,tx-ax), dist=Math.hypot(tx-ax,ty-ay);
    sparks(fx,ax,ay,"#e2e8f0",6,26,0,6);
    for(let i=0;i<5;i++){
      const fan=(i-2)*0.3, bx=ax+Math.cos(ang+fan)*34, by=ay+Math.sin(ang+fan)*34;
      fxNode(fx,{left:bx,top:by,ang:ang,style:{width:"26px",height:"6px",
        background:"linear-gradient(90deg,#f8fafc,#94a3b8,#f8fafc)",boxShadow:"0 0 10px #cbd5e1",borderRadius:"3px"},
        anim:"fxPop .22s ease-out "+(i*46)+"ms forwards",life:i*46+300});
      fxNode(fx,{left:bx,top:by,dx:tx-bx,dy:ty-by,ang:ang,style:{width:"26px",height:"6px",
        background:"linear-gradient(90deg,#f8fafc,#94a3b8)",boxShadow:"0 0 10px #e2e8f0",borderRadius:"3px",
        transform:"translate(-50%,-50%) rotate("+ang+"rad)"},
        anim:"fxProj .26s linear "+(200+i*52)+"ms forwards",life:200+i*52+380});
    }
    after(500,()=>{
      fxNode(fx,{left:tx,top:ty,ang:-38*RAD,style:{width:"120px",height:"6px",background:"linear-gradient(90deg,transparent,#ffffff,transparent)",boxShadow:"0 0 14px #e2e8f0"},anim:"fxSlash .3s ease-out forwards",life:420});
      fxNode(fx,{left:tx,top:ty,ang:38*RAD,style:{width:"120px",height:"6px",background:"linear-gradient(90deg,transparent,#ffffff,transparent)",boxShadow:"0 0 14px #e2e8f0"},anim:"fxSlash .3s ease-out 90ms forwards",life:520});
      impactBurst(fx,tx,ty,"#cbd5e1","#64748b",60);
      debrisArc(fx,tx,ty,"#64748b",6,120);
    });
  }},
  /* 5) 바람 — 나선환: 회오리 링 수렴 → 쌍나선 구체 + 바람 줄기 → 상승 토네이도(회전 링 적층) */
  wind: { name:"나선환", impact:580, dur:1060, build(fx,ax,ay,tx,ty){
    const dx=tx-ax, dy=ty-ay;
    for(let i=0;i<3;i++) fxNode(fx,{left:ax,top:ay,style:ring(30+i*16,"#7dd3fc",3),
      anim:"fxImplode .34s ease-in "+(i*54)+"ms forwards",life:i*54+440});
    fxNode(fx,{left:ax,top:ay,dx,dy,style:ring(30,"#7dd3fc",5),anim:"fxSpiral .46s ease-in 190ms forwards",life:760});
    fxNode(fx,{left:ax,top:ay,dx,dy,mx:dx/2,my:dy/2-34,style:emojiStyle(26,"#38bdf8"),text:"🌀",anim:"fxCurve .46s ease-in 190ms forwards",life:760});
    for(let i=0;i<5;i++){ const off=(i-2)*10;
      beamLine(fx,ax,ay+off,tx,ty+off,2,"linear-gradient(90deg,transparent,#e0f2fe)","#bae6fd",170+i*30,300); }
    after(560,()=>{
      for(let i=0;i<4;i++) fxNode(fx,{left:tx,top:ty+14-i*20,style:ring(58-i*10,"#38bdf8",4),
        anim:"fxSpin .55s linear "+(i*70)+"ms forwards",life:i*70+700});
      impactBurst(fx,tx,ty,"#38bdf8","#0284c7");
      floatUp(fx,tx,ty,"#bae6fd",6,120);
    });
  }},
  /* 6) 공허 — 공허 붕괴: 암흑성 팽창·역광륜 → 왜곡 구체(경로상 링 붕괴) → 대흡수·암흑 신성 폭발 */
  void: { name:"공허 붕괴", impact:700, dur:1150, build(fx,ax,ay,tx,ty){
    const dx=tx-ax, dy=ty-ay;
    fxNode(fx,{left:ax,top:ay,style:circle(30,"#312e81","#000000"),anim:"fxPop .34s ease-out forwards",life:440});
    fxNode(fx,{left:ax,top:ay,style:ring(46,"#a855f7",3),anim:"fxImplode .4s ease-in forwards",life:520});
    fxNode(fx,{left:ax,top:ay,dx,dy,style:circle(24,"#4c1d95","#0b1020"),anim:"fxProj .4s ease-in 230ms forwards",life:700});
    for(let i=0;i<4;i++){ const f=(i+1)/5;
      fxNode(fx,{left:ax+dx*f,top:ay+dy*f,style:ring(34,"#7c3aed",2),
        anim:"fxImplode .36s ease-in "+(230+i*70)+"ms forwards",life:230+i*70+480}); }
    after(620,()=>{
      for(let i=0;i<14;i++){ const a=i*(360/14)*RAD, d=52+Math.random()*32;
        fxNode(fx,{left:tx,top:ty,dx:Math.cos(a)*d,dy:Math.sin(a)*d,style:circle(9,"#ddd6fe","#7c3aed"),
          anim:"fxSuck .5s ease-in "+(i*14)+"ms forwards",life:i*14+640}); }
      fxNode(fx,{left:tx,top:ty,style:circle(78,"#4c1d95","#a855f7"),anim:"fxImplode .55s ease-in 60ms forwards",life:720});
      fxNode(fx,{left:tx,top:ty,style:circle(44,"#0b1020","#7c3aed"),anim:"fxImplode .55s ease-in 130ms forwards",life:800});
      after(430,()=>{ flashAt(fx,tx,ty,"#a855f7",96,0);
        fxNode(fx,{left:tx,top:ty,style:ring(60,"#c4b5fd",3),anim:"fxRipple .5s ease-out forwards",life:620});
        sparks(fx,tx,ty,"#a855f7",10,52,0,8); });
    });
  }},
  /* 7) 신성 — 천벌: 표적 상공 황금 마법진 → 번개+빛기둥 강림 → 십자 섬광 + 깃털빛 낙하 */
  holy: { name:"천벌", impact:620, dur:1100, build(fx,ax,ay,tx,ty){
    const sealY=Math.max(28,ty-170);
    fxNode(fx,{left:tx,top:sealY,style:ring(66,"#facc15",4),anim:"fxRune .55s ease-out forwards",life:700});
    fxNode(fx,{left:tx,top:sealY,style:ring(42,"#fde047",3),anim:"fxRune .55s ease-out 70ms forwards",life:780});
    fxNode(fx,{left:tx,top:sealY,style:emojiStyle(20,"#facc15"),text:"✝️",anim:"fxPop .4s ease-out 120ms forwards",life:620});
    after(380,()=>{
      const h=ty-sealY+26;
      fxNode(fx,{left:tx,top:sealY,style:{width:"8px",height:h+"px",background:"#fffde7",boxShadow:"0 0 18px #fde047",
        clipPath:"polygon(20% 0,80% 0,55% 34%,100% 34%,30% 100%,48% 52%,0 52%)"},origin:"top center",
        anim:"fxPillar .22s ease-out forwards",life:340});
      fxNode(fx,{left:tx,top:sealY,style:{width:"36px",height:h+"px",background:"linear-gradient(#fef9c3,#facc15,rgba(250,204,21,0))",
        boxShadow:"0 0 30px #fde047",borderRadius:"10px"},origin:"top center",anim:"fxPillar .5s ease-out 60ms forwards",life:720});
    });
    after(600,()=>{
      fxNode(fx,{left:tx,top:ty,ang:0,style:{width:"130px",height:"7px",background:"linear-gradient(90deg,transparent,#fff,transparent)",boxShadow:"0 0 16px #fde047"},anim:"fxSlash .34s ease-out forwards",life:460});
      fxNode(fx,{left:tx,top:ty,ang:90*RAD,style:{width:"130px",height:"7px",background:"linear-gradient(90deg,transparent,#fff,transparent)",boxShadow:"0 0 16px #fde047"},anim:"fxSlash .34s ease-out 60ms forwards",life:520});
      impactBurst(fx,tx,ty,"#facc15","#ca8a04");
      for(let i=0;i<7;i++) fxNode(fx,{left:tx+(Math.random()-0.5)*76,top:ty-36,dx:(Math.random()-0.5)*24,dy:58,
        style:emojiStyle(13,"#fde047"),text:"✨",anim:"fxGravity .9s ease-in "+(120+i*70)+"ms forwards",life:120+i*70+1050});
    });
  }},
  /* 8) 고대 — 고대 룬: 석판 룬 3매 부채 소환 → 룬 문자가 청동 쌍빔 위를 활공 → 인장 각인 + 균열 + 흙먼지 */
  ancient: { name:"고대 룬", impact:600, dur:1100, build(fx,ax,ay,tx,ty){
    const runes=["ᚠ","ᚱ","ᛟ"];
    for(let i=0;i<3;i++){ const a=(-40+i*40)*RAD;
      fxNode(fx,{left:ax+Math.cos(a)*36,top:ay+Math.sin(a)*36,style:{fontSize:"18px",color:"#f59e0b",
        textShadow:"0 0 10px #d97706",fontWeight:"900"},text:runes[i],anim:"fxPop .3s ease-out "+(i*70)+"ms forwards",life:i*70+700}); }
    beamLine(fx,ax,ay,tx,ty,9,"linear-gradient(90deg,rgba(180,83,9,0),#f59e0b,#b45309)","#d97706",250,430);
    beamLine(fx,ax,ay,tx,ty,3,"linear-gradient(90deg,rgba(255,255,255,0),#fef3c7)","#fde68a",310,370);
    for(let i=0;i<3;i++){ const f=0.25+i*0.25;
      fxNode(fx,{left:ax,top:ay,dx:(tx-ax),dy:(ty-ay),style:{fontSize:"16px",color:"#fde68a",textShadow:"0 0 8px #f59e0b",fontWeight:"900"},
        text:runes[i],anim:"fxProj .34s linear "+(280+i*60)+"ms forwards",life:280+i*60+460}); }
    after(600,()=>{
      fxNode(fx,{left:tx,top:ty,style:ring(80,"#d97706",4),anim:"fxRune .6s ease-out forwards",life:760});
      fxNode(fx,{left:tx,top:ty,style:ring(52,"#f59e0b",3),anim:"fxRune .6s ease-out 70ms forwards",life:820});
      fxNode(fx,{left:tx,top:ty,style:{fontSize:"26px",color:"#fbbf24",textShadow:"0 0 14px #d97706",fontWeight:"900"},text:"ᛝ",anim:"fxPop .5s ease-out forwards",life:640});
      for(let i=0;i<5;i++){ const a=i*72*RAD;
        fxNode(fx,{left:tx,top:ty,ang:a,style:{width:"56px",height:"3px",background:"linear-gradient(90deg,#78350f,transparent)",boxShadow:"0 0 6px #92400e"},anim:"fxSlash .4s ease-out "+(80+i*40)+"ms forwards",life:640}); }
      impactBurst(fx,tx,ty,"#f59e0b","#b45309");
      debrisArc(fx,tx,ty,"#92400e",5,140);
    });
  }},
  /* 9) 대지 — 메테오: 낙하지점 그림자·경고 링 → 실제 궤도각 운석 + 화염꼬리 → 크레이터·암석 포물선·흙먼지 */
  earth: { name:"메테오", impact:700, dur:1250, build(fx,ax,ay,tx,ty){
    const W=(fx.parentElement?fx.parentElement.clientWidth:700);
    const sx=Math.min(W-30, tx+140), sy=Math.max(12, ty-300);
    const mAng=Math.atan2(ty-sy, tx-sx); // 실제 궤도각 (기존 고정 45deg 버그 수정)
    fxNode(fx,{left:tx,top:ty+16,style:{width:"70px",height:"22px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(0,0,0,.65),transparent)"},anim:"fxShadow .5s ease-out forwards",life:800});
    fxNode(fx,{left:tx,top:ty,style:ring(50,"#ef4444",3),anim:"fxBlink .5s linear forwards",life:600});
    after(420,()=>{
      fxNode(fx,{left:sx,top:sy,dx:tx-sx,dy:ty-sy,style:{fontSize:"42px",filter:"drop-shadow(0 0 12px #f97316)",
        transform:"translate(-50%,-50%) rotate("+(mAng+2.4)+"rad)"},text:"☄️",anim:"fxProj .3s cubic-bezier(.5,0,1,1) forwards",life:420});
      for(let i=0;i<7;i++){ const f=(i+1)/8;
        fxNode(fx,{left:sx+(tx-sx)*f,top:sy+(ty-sy)*f,style:circle(9+Math.random()*11,"#fed7aa","#ea580c"),
          anim:"fxTrail .34s ease-out "+(i*18)+"ms forwards",life:i*18+480}); }
    });
    after(700,()=>{
      flashAt(fx,tx,ty,"#fdba74",110,0);
      fxNode(fx,{left:tx,top:ty,style:ring(70,"#b45309",6),anim:"fxRipple .6s ease-out forwards",life:760});
      shockwave(fx,tx,ty,"#78350f",90);
      debrisArc(fx,tx,ty,"#78350f",10,40);
      for(let i=0;i<6;i++) fxNode(fx,{left:tx+(i-2.5)*22,top:ty+8,style:{width:"34px",height:"34px",borderRadius:"50%",
        background:"radial-gradient(circle,rgba(120,90,60,.55),transparent)"},anim:"fxFlash .8s ease-out "+(80+i*60)+"ms forwards",life:1050});
      fxNode(fx,{left:tx,top:ty,style:emojiStyle(30,"#b45309"),text:"💥",anim:"fxPop .5s ease-out forwards",life:620});
    });
  }},
};

/* ===== 전설 등급 궁극기: 속성마다 다른 오버드라이브 =====
   각 속성의 기본 모션을 그대로 살리고(고유 정체성) + 충전/컬러 대형 빔/스타버스트를 덧씌운다. */
const ULT_NAMES = {
  fire:"이프리트의 지옥불", water:"심연의 대해일", forest:"세계수의 진노",
  metal:"천공의 강철비", wind:"폭풍군주의 강림", void:"종언의 대공허",
  holy:"신벌: 천상의 심판", ancient:"창세의 룬 붕괴", earth:"대지멸살 메테오",
};
// 속성별 궁극기 전용 시그니처 피니시 (기본기와 완전히 구분되는 개성)
const ULT_ACCENTS = {
  fire(fx,ax,ay,tx,ty){ // 지옥불 기둥 3개가 표적 주변에서 솟구침
    for(let i=0;i<3;i++) pillarUp(fx,tx+(i-1)*34,ty+26,16,110,"linear-gradient(#fff7ed,#fb923c,#7f1d1d)","#ef4444",i*110,560);
    floatUp(fx,tx,ty,"#f97316",10,200,"🔥");
  },
  water(fx,ax,ay,tx,ty){ // 해일 벽이 표적을 휩쓸고 지나감
    fxNode(fx,{left:tx,top:ty,style:{width:"150px",height:"84px",borderRadius:"46% 54% 0 0/90% 100% 0 0",
      background:"linear-gradient(#eff6ff,#3b82f6,#1e3a8a)",boxShadow:"0 0 26px #3b82f6"},origin:"bottom center",
      anim:"fxVine .6s ease-out forwards",life:760});
    shockwave(fx,tx,ty,"#60a5fa",320); shockwave(fx,tx,ty,"#2563eb",460);
  },
  forest(fx,ax,ay,tx,ty){ // 세계수 거목 + 넝쿨 감옥
    pillarUp(fx,tx,ty+30,22,140,"linear-gradient(#bbf7d0,#16a34a,#052e16)","#22c55e",0,640);
    for(let i=0;i<4;i++) pillarUp(fx,tx-42+i*28,ty+30,7,74+((i*37)%38),"linear-gradient(#86efac,#166534)","#22c55e",120+i*80,540);
    fxNode(fx,{left:tx,top:ty-64,style:emojiStyle(30,"#22c55e"),text:"🌳",anim:"fxPop .5s ease-out 320ms forwards",life:960});
  },
  metal(fx,ax,ay,tx,ty){ // 강철비: 하늘에서 칼날 8개 낙하
    for(let i=0;i<8;i++){ const x=tx+(Math.random()-0.5)*110, sy=Math.max(12,ty-210);
      fxNode(fx,{left:x,top:sy,dx:0,dy:ty-sy+(Math.random()*16),style:{width:"5px",height:"26px",
        background:"linear-gradient(#f8fafc,#64748b)",boxShadow:"0 0 8px #cbd5e1",borderRadius:"2px"},
        anim:"fxProj .3s cubic-bezier(.5,0,1,1) "+(i*60)+"ms forwards",life:i*60+430}); }
    sparks(fx,tx,ty,"#e2e8f0",12,58,520,7);
  },
  wind(fx,ax,ay,tx,ty){ // 초대형 쌍폭풍 기둥
    for(let s=0;s<2;s++) for(let i=0;i<5;i++)
      fxNode(fx,{left:tx+(s?26:-26),top:ty+20-i*24,style:ring(64-i*9,"#7dd3fc",4),
        anim:"fxSpin .5s linear "+(s*90+i*60)+"ms forwards",life:s*90+i*60+660});
    floatUp(fx,tx,ty,"#bae6fd",8,220);
  },
  void(fx,ax,ay,tx,ty){ // 특대 블랙홀: 화면의 별을 모조리 흡수 후 붕괴
    for(let i=0;i<18;i++){ const a=i*20*RAD, d=90+Math.random()*46;
      fxNode(fx,{left:tx,top:ty,dx:Math.cos(a)*d,dy:Math.sin(a)*d,style:circle(8,"#ddd6fe","#7c3aed"),
        anim:"fxSuck .6s ease-in "+(i*16)+"ms forwards",life:i*16+760}); }
    fxNode(fx,{left:tx,top:ty,style:circle(120,"#1e1b4b","#a855f7"),anim:"fxImplode .7s ease-in 180ms forwards",life:960});
    after(760,()=>flashAt(fx,tx,ty,"#c4b5fd",130,0));
  },
  holy(fx,ax,ay,tx,ty){ // 삼연 심판 기둥 + 대형 마법진
    const sealY=Math.max(26,ty-180);
    fxNode(fx,{left:tx,top:sealY,style:ring(96,"#facc15",5),anim:"fxRune .7s ease-out forwards",life:880});
    for(let i=0;i<3;i++){ const x=tx+(i-1)*40, h=ty-sealY+30;
      fxNode(fx,{left:x,top:sealY,style:{width:"22px",height:h+"px",background:"linear-gradient(#fef9c3,#facc15,rgba(250,204,21,0))",
        boxShadow:"0 0 22px #fde047",borderRadius:"8px"},origin:"top center",anim:"fxPillar .5s ease-out "+(200+i*130)+"ms forwards",life:200+i*130+700}); }
  },
  ancient(fx,ax,ay,tx,ty){ // 이중 대인장 + 룬 폭풍
    fxNode(fx,{left:tx,top:ty,style:ring(110,"#d97706",5),anim:"fxRune .8s ease-out forwards",life:980});
    fxNode(fx,{left:tx,top:ty,style:ring(76,"#f59e0b",4),anim:"fxRune .8s ease-out 120ms forwards",life:1060});
    const rs=["ᚠ","ᚱ","ᛟ","ᛝ","ᚹ","ᛉ"];
    for(let i=0;i<6;i++){ const a=i*60*RAD;
      fxNode(fx,{left:tx+Math.cos(a)*52,top:ty+Math.sin(a)*52,style:{fontSize:"17px",color:"#fbbf24",
        textShadow:"0 0 10px #d97706",fontWeight:"900"},text:rs[i],anim:"fxPop .5s ease-out "+(160+i*70)+"ms forwards",life:160+i*70+680}); }
  },
  earth(fx,ax,ay,tx,ty){ // 삼연 메테오 (동시 예고 그림자 → 시차 낙하)
    for(let i=0;i<3;i++){ const x=tx+(i-1)*44, delay=i*150;
      fxNode(fx,{left:x,top:ty+14,style:{width:"46px",height:"15px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(0,0,0,.6),transparent)"},anim:"fxShadow .4s ease-out "+delay+"ms forwards",life:delay+620});
      after(delay+240,()=>{ const sy=Math.max(12,ty-230);
        fxNode(fx,{left:x+70,top:sy,dx:-70,dy:ty-sy,style:{fontSize:"26px",filter:"drop-shadow(0 0 10px #f97316)"},text:"☄️",anim:"fxProj .26s cubic-bezier(.5,0,1,1) forwards",life:380});
        after(270,()=>{ flashAt(fx,x,ty,"#fdba74",64,0); debrisArc(fx,x,ty,"#78350f",5,0); }); });
    }
  },
};
ELEM_KEYS.forEach(k=>{
  const base = ATTACK_FX[k];
  const col = ELEMENTS[k].color;
  ATTACK_FX[k+"_ult"] = {
    name: ULT_NAMES[k], element:k, impact: base.impact+120, dur: base.dur+420,
    build(fx,ax,ay,tx,ty){
      // 공통 충전 연출
      fxNode(fx,{left:ax,top:ay,style:ring(36,col,5),anim:"fxPop .4s ease-out forwards",life:480});
      fxNode(fx,{left:ax,top:ay,style:ring(62,"#ffffff",3),anim:"fxFlash .5s ease-out forwards",life:580});
      converge(fx,ax,ay,col,10,0);
      // 원래 속성 모션 (정체성 유지)
      try{ base.build(fx,ax,ay,tx,ty); }catch(e){}
      // 속성 컬러 대형 빔
      beamLine(fx,ax,ay,tx,ty,20,"linear-gradient(90deg,"+col+"00,"+col+",#ffffff)",col,180,620);
      beamLine(fx,ax,ay,tx,ty,7,"#ffffff","#ffffff",230,570);
      // 시그니처 피니시 + 스타버스트
      setTimeout(()=>{
        try{ ULT_ACCENTS[k](fx,ax,ay,tx,ty); }catch(e){}
        for(let i=0;i<14;i++){ const a=i*(360/14)*RAD, d=54+Math.random()*40;
          fxNode(fx,{left:tx,top:ty,dx:Math.cos(a)*d,dy:Math.sin(a)*d,style:circle(11,"#fff",col),anim:"fxBurst .6s ease-out forwards",life:760}); }
        flashAt(fx,tx,ty,col,110,0);
        impactBurst(fx,tx,ty,col,"#ffffff",60);
      }, base.impact+60);
    }
  };
});

/* ===== 각성 전용 공격 모션 (전설 궁극기의 상위 티어) =====
   각성한 전설만 사용. 궁극기와도 완전히 다른 시네마틱 연출 + 임팩트 프레임. */
const AWK_NAMES = {
  fire:"업화천붕", water:"만해붕류", forest:"수해만개", metal:"천겁단두대", wind:"천람폭풍옥",
  void:"허무종언겁", holy:"천상개벽", ancient:"태고창세인", earth:"붕천멸지성",
};
const AWK_BUILDERS = {
  fire(fx,ax,ay,tx,ty){ // 화룡 강림: 화염 용 궤적 + 경로 위 지옥불 융단 + 태양 플레어
    converge(fx,ax,ay,"#f97316",12,0);
    fxNode(fx,{left:ax,top:ay,dx:tx-ax,dy:ty-ay,mx:(tx-ax)/2,my:(ty-ay)/2-70,
      style:{fontSize:"40px",filter:"drop-shadow(0 0 16px #ef4444) hue-rotate(-20deg) saturate(2)"},text:"🐲",
      anim:"fxCurve .6s ease-in 200ms forwards",life:900});
    for(let i=0;i<5;i++){ const f=(i+1)/6, px=ax+(tx-ax)*f, py=ay+(ty-ay)*f;
      pillarUp(fx,px,py+26,14,86,"linear-gradient(#fff7ed,#fb923c,#7f1d1d)","#ef4444",320+i*90,540); }
    after(820,()=>{ flashAt(fx,tx,ty,"#fb923c",150,0);
      fxNode(fx,{left:tx,top:ty,style:ring(96,"#f97316",6),anim:"fxRipple .7s ease-out forwards",life:860});
      fxNode(fx,{left:tx,top:ty,style:ring(60,"#fff7ed",4),anim:"fxRipple .6s ease-out 120ms forwards",life:920});
      floatUp(fx,tx,ty,"#f97316",14,100,"🔥"); sparks(fx,tx,ty,"#ef4444",14,70,0,10); });
  },
  water(fx,ax,ay,tx,ty){ // 해룡 물결진: 사행 파도 행렬 + 소용돌이 + 삼중 물기둥
    for(let i=0;i<5;i++){ const up=i%2?1:-1;
      fxNode(fx,{left:ax,top:ay,dx:tx-ax,dy:ty-ay,mx:(tx-ax)/2,my:(ty-ay)/2+up*46,
        style:circle(20-i*2,"#eff6ff","#2563eb"),anim:"fxCurve .55s ease-in "+(i*80)+"ms forwards",life:i*80+760}); }
    after(620,()=>{
      for(let i=0;i<3;i++) fxNode(fx,{left:tx,top:ty,style:ring(46+i*24,"#60a5fa",4),anim:"fxSpin .6s linear "+(i*100)+"ms forwards",life:i*100+760});
      pillarUp(fx,tx,ty+24,30,120,"linear-gradient(#eff6ff,#60a5fa,#1e3a8a)","#3b82f6",80,620);
      pillarUp(fx,tx-30,ty+24,18,84,"linear-gradient(#eff6ff,#3b82f6)","#2563eb",200,560);
      pillarUp(fx,tx+30,ty+24,18,92,"linear-gradient(#eff6ff,#3b82f6)","#2563eb",300,560);
      shockwave(fx,tx,ty,"#3b82f6",160);
      for(let i=0;i<10;i++) fxNode(fx,{left:tx+(Math.random()-0.5)*90,top:ty-60,dx:(Math.random()-0.5)*24,dy:80,
        style:circle(7,"#eff6ff","#3b82f6"),anim:"fxGravity .7s ease-in "+(300+i*40)+"ms forwards",life:300+i*40+860}); });
  },
  forest(fx,ax,ay,tx,ty){ // 세계수 만개: 거목 + 뿌리 가시 행렬 + 전장 꽃보라
    fxNode(fx,{left:ax,top:ay,style:ring(50,"#22c55e",4),anim:"fxRune .5s ease-out forwards",life:640});
    after(300,()=>{
      pillarUp(fx,tx,ty+30,26,150,"linear-gradient(#bbf7d0,#16a34a,#052e16)","#22c55e",0,680);
      fxNode(fx,{left:tx,top:ty-78,style:circle(64,"#86efac","#166534"),anim:"fxPop .5s ease-out 300ms forwards",life:1150});
      for(let i=0;i<6;i++){ const x=tx-60+i*24;
        fxNode(fx,{left:x,top:ty+26,origin:"bottom center",style:{width:"8px",height:(34+(i*29)%30)+"px",
          background:"linear-gradient(#86efac,#14532d)",clipPath:"polygon(50% 0,100% 100%,0 100%)"},
          anim:"fxVine .45s ease-out "+(150+i*70)+"ms forwards",life:150+i*70+620}); }
      for(let i=0;i<12;i++) fxNode(fx,{left:tx+(Math.random()-0.5)*150,top:ty-110,dx:(Math.random()-0.5)*46,dy:130,
        style:emojiStyle(12+Math.random()*7,"#4ade80"),text:"🌸",anim:"fxGravity 1.1s ease-in "+(350+i*70)+"ms forwards",life:350+i*70+1300});
      impactBurst(fx,tx,ty,"#22c55e","#15803d",350); });
  },
  metal(fx,ax,ay,tx,ty){ // 천겁 단두대: 거대 참수도 낙하 + 칼날 궤도 수렴 + 십자 4연 절단
    for(let i=0;i<10;i++){ const a=i*36*RAD, d=72;
      fxNode(fx,{left:tx,top:ty,dx:Math.cos(a)*d,dy:Math.sin(a)*d,ang:a,
        style:{width:"22px",height:"5px",background:"linear-gradient(90deg,#f8fafc,#94a3b8)",boxShadow:"0 0 8px #cbd5e1"},
        anim:"fxSuck .5s ease-in "+(i*30)+"ms forwards",life:i*30+640}); }
    after(460,()=>{ const sy=Math.max(10,ty-190);
      fxNode(fx,{left:tx+6,top:sy,dx:0,dy:ty-sy,style:{width:"16px",height:"64px",
        background:"linear-gradient(90deg,#f8fafc,#94a3b8,#475569)",clipPath:"polygon(0 0,100% 0,100% 78%,50% 100%,0 78%)",
        boxShadow:"0 0 22px #e2e8f0"},anim:"fxProj .22s cubic-bezier(.6,0,1,1) forwards",life:340});
      after(240,()=>{ flashAt(fx,tx,ty,"#e2e8f0",130,0);
        for(let k=0;k<4;k++) fxNode(fx,{left:tx,top:ty,ang:(k*45)*RAD,style:{width:"140px",height:"6px",
          background:"linear-gradient(90deg,transparent,#ffffff,transparent)",boxShadow:"0 0 16px #e2e8f0"},
          anim:"fxSlash .3s ease-out "+(k*70)+"ms forwards",life:k*70+440});
        sparks(fx,tx,ty,"#e2e8f0",16,74,120,8); debrisArc(fx,tx,ty,"#64748b",8,160); }); });
  },
  wind(fx,ax,ay,tx,ty){ // 폭풍옥: 전장 관통 바람줄기 + 쌍폭풍 기둥 + 진공구
    const W=(fx.parentElement?fx.parentElement.clientWidth:700);
    for(let i=0;i<5;i++){ const y=ty-46+i*23;
      beamLine(fx,10,y,W-10,y,3,"linear-gradient(90deg,transparent,#e0f2fe,transparent)","#bae6fd",i*70,420); }
    after(380,()=>{
      for(let s=0;s<2;s++) for(let i=0;i<6;i++)
        fxNode(fx,{left:tx+(s?34:-34),top:ty+22-i*24,style:ring(70-i*9,"#7dd3fc",4),
          anim:"fxSpin .5s linear "+(s*80+i*55)+"ms forwards",life:s*80+i*55+680});
      fxNode(fx,{left:tx,top:ty,style:ring(40,"#e0f2fe",6),anim:"fxImplode .5s ease-in 260ms forwards",life:860});
      after(560,()=>{ flashAt(fx,tx,ty,"#7dd3fc",120,0); sparks(fx,tx,ty,"#38bdf8",14,80,0,9); floatUp(fx,tx,ty,"#bae6fd",10,80); }); });
  },
  void(fx,ax,ay,tx,ty){ // 종언겁: 세계 암전 + 공간 균열 + 특이점 붕괴 + 백색 신성
    const W=(fx.parentElement?fx.parentElement.clientWidth:700), H=(fx.parentElement?fx.parentElement.clientHeight:500);
    fxNode(fx,{left:W/2,top:H/2,style:{width:W+"px",height:H+"px",background:"#0b1020",borderRadius:"12px","--fo":".62"},
      anim:"fxScreen 1.2s ease-out forwards",life:1300});
    beamLine(fx,10,ty,W-10,ty,10,"linear-gradient(90deg,transparent,#a855f7,#ffffff,#a855f7,transparent)","#a855f7",180,520);
    after(420,()=>{
      for(let i=0;i<16;i++){ const a=i*22.5*RAD, d=96;
        fxNode(fx,{left:tx,top:ty,dx:Math.cos(a)*d,dy:Math.sin(a)*d,style:circle(9,"#ddd6fe","#7c3aed"),
          anim:"fxSuck .55s ease-in "+(i*18)+"ms forwards",life:i*18+700}); }
      fxNode(fx,{left:tx,top:ty,style:circle(130,"#1e1b4b","#a855f7"),anim:"fxImplode .65s ease-in 150ms forwards",life:920});
      after(640,()=>{ flashAt(fx,tx,ty,"#ffffff",170,0);
        fxNode(fx,{left:tx,top:ty,style:ring(90,"#c4b5fd",4),anim:"fxRipple .6s ease-out forwards",life:760});
        fxNode(fx,{left:tx,top:ty,style:ring(56,"#ffffff",3),anim:"fxRipple .55s ease-out 90ms forwards",life:800}); }); });
  },
  holy(fx,ax,ay,tx,ty){ // 천상개벽: 이중 대마법진 + 광주 5연 강림 + 깃털 폭풍
    const sealY=Math.max(24,ty-190);
    fxNode(fx,{left:tx,top:sealY,style:ring(110,"#facc15",5),anim:"fxRune .8s ease-out forwards",life:1000});
    fxNode(fx,{left:tx,top:sealY,style:ring(74,"#fde047",4),anim:"fxRune .8s ease-out 120ms forwards",life:1100});
    for(let i=0;i<5;i++){ const x=tx-56+i*28, h=ty-sealY+30, dl=260+i*110;
      fxNode(fx,{left:x,top:sealY,style:{width:"18px",height:h+"px",background:"linear-gradient(#fef9c3,#facc15,rgba(250,204,21,0))",
        boxShadow:"0 0 20px #fde047",borderRadius:"8px"},origin:"top center",anim:"fxPillar .4s ease-out "+dl+"ms forwards",life:dl+620});
      after(dl+180,()=>flashAt(fx,x,ty,"#fde047",56,0)); }
    after(860,()=>{ impactBurst(fx,tx,ty,"#facc15","#ffffff");
      for(let i=0;i<10;i++) fxNode(fx,{left:tx+(Math.random()-0.5)*130,top:ty-100,dx:(Math.random()-0.5)*36,dy:120,
        style:emojiStyle(13,"#fde047"),text:"✨",anim:"fxGravity 1.1s ease-in "+(i*80)+"ms forwards",life:i*80+1300}); });
  },
  ancient(fx,ax,ay,tx,ty){ // 창세인: 하늘에서 대오벨리스크 강하 + 룬 기둥 원진 + 연쇄 각인
    const sy=Math.max(10,ty-230);
    fxNode(fx,{left:tx,top:sy,dx:0,dy:ty-sy,style:{width:"22px",height:"66px",
      background:"linear-gradient(#fde68a,#d97706,#78350f)",clipPath:"polygon(50% 0,100% 18%,100% 100%,0 100%,0 18%)",
      boxShadow:"0 0 20px #d97706"},anim:"fxProj .3s cubic-bezier(.6,0,1,1) 150ms forwards",life:560});
    after(440,()=>{
      flashAt(fx,tx,ty,"#f59e0b",110,0);
      const rs=["ᚠ","ᚱ","ᛟ","ᛝ","ᚹ","ᛉ"];
      for(let i=0;i<6;i++){ const a=i*60*RAD, px=tx+Math.cos(a)*58, py=ty+Math.sin(a)*40;
        pillarUp(fx,px,py+16,8,44,"linear-gradient(#fde68a,#92400e)","#d97706",i*80,520);
        fxNode(fx,{left:px,top:py-34,style:{fontSize:"15px",color:"#fbbf24",textShadow:"0 0 10px #d97706",fontWeight:"900"},
          text:rs[i],anim:"fxPop .4s ease-out "+(i*80+180)+"ms forwards",life:i*80+880}); }
      for(let i=0;i<6;i++){ const a1=i*60*RAD, a2=((i+1)%6)*60*RAD;
        beamLine(fx,tx+Math.cos(a1)*58,ty+Math.sin(a1)*40,tx+Math.cos(a2)*58,ty+Math.sin(a2)*40,3,
          "linear-gradient(90deg,#f59e0b88,#fde68a)","#d97706",480+i*60,360); }
      fxNode(fx,{left:tx,top:ty,style:ring(96,"#d97706",5),anim:"fxRune .8s ease-out 300ms forwards",life:1200});
      impactBurst(fx,tx,ty,"#f59e0b","#b45309",320); });
  },
  earth(fx,ax,ay,tx,ty){ // 멸지성: 대지 균열 + 유성군 5연 + 암석 융기 성벽
    for(let i=0;i<3;i++) fxNode(fx,{left:tx,top:ty+18,ang:(-20+i*20)*RAD,
      style:{width:"150px",height:"6px",background:"linear-gradient(90deg,transparent,#78350f,#3f1f0a,transparent)",boxShadow:"0 0 8px #78350f"},
      anim:"fxSlash .4s ease-out "+(i*90)+"ms forwards",life:i*90+560});
    for(let i=0;i<5;i++){ const x=tx-64+i*32, dl=260+i*120, sy=Math.max(10,ty-240);
      fxNode(fx,{left:x,top:ty+14,style:{width:"40px",height:"13px",borderRadius:"50%",
        background:"radial-gradient(ellipse,rgba(0,0,0,.6),transparent)"},anim:"fxShadow .35s ease-out "+(dl-180)+"ms forwards",life:dl+300});
      after(dl,()=>{ fxNode(fx,{left:x+56,top:sy,dx:-56,dy:ty-sy,style:{fontSize:"24px",filter:"drop-shadow(0 0 10px #f97316)"},
          text:"☄️",anim:"fxProj .24s cubic-bezier(.6,0,1,1) forwards",life:340});
        after(250,()=>{ flashAt(fx,x,ty,"#fdba74",58,0); debrisArc(fx,x,ty,"#78350f",4,0); }); }); }
    after(900,()=>{ for(let i=0;i<4;i++) pillarUp(fx,tx-45+i*30,ty+26,16,52+((i*23)%26),
        "linear-gradient(#d6d3d1,#78350f,#44403c)","#92400e",i*80,560);
      shockwave(fx,tx,ty,"#b45309",120);
      for(let i=0;i<5;i++) fxNode(fx,{left:tx+(i-2)*28,top:ty+6,style:{width:"40px",height:"40px",borderRadius:"50%",
        background:"radial-gradient(circle,rgba(120,90,60,.5),transparent)"},anim:"fxFlash .9s ease-out "+(i*70)+"ms forwards",life:1100}); });
  },
};
ELEM_KEYS.forEach(k=>{
  ATTACK_FX[k+"_awk"] = { name:AWK_NAMES[k], element:k,
    impact: 860, dur: 1600,
    build(fx,ax,ay,tx,ty){
      // 각성 발동 공통: 황금 이중 링 + 속성 수렴
      fxNode(fx,{left:ax,top:ay,style:ring(42,"#fde047",5),anim:"fxPop .4s ease-out forwards",life:520});
      fxNode(fx,{left:ax,top:ay,style:ring(70,ELEMENTS[k].color,3),anim:"fxFlash .55s ease-out forwards",life:640});
      try{ AWK_BUILDERS[k](fx,ax,ay,tx,ty); }catch(e){}
      // 대형 임팩트 스타버스트
      after(880,()=>{ for(let i=0;i<16;i++){ const a=i*22.5*RAD, d=60+Math.random()*46;
          fxNode(fx,{left:tx,top:ty,dx:Math.cos(a)*d,dy:Math.sin(a)*d,style:circle(12,"#fff",ELEMENTS[k].color),
            anim:"fxBurst .65s ease-out forwards",life:820}); } });
    }
  };
});

// 드래곤/속성에 따라 사용할 공격 모션 결정: 각성 전설 > 전설 궁극기 > 기본
function pickFxType(dragon, elem){
  if(dragon && dragon.grade==="legendary" && dragon.awakened && ATTACK_FX[elem+"_awk"]) return elem+"_awk";
  if(dragon && dragon.grade==="legendary" && ATTACK_FX[elem+"_ult"]) return elem+"_ult";
  return elem;
}
// 도감/표시용 이름
function ultNameFor(elem){ const t=ATTACK_FX[elem+"_ult"]; return t?t.name:""; }
function awkNameFor(elem){ const t=ATTACK_FX[elem+"_awk"]; return t?t.name:""; }

/* ============ 각성 시스템 ============
   500골드로 '각성의 비늘'을 사고, 10개를 모아 전설 등급을 각성시킨다.
   각성 시 능력치가 영구 상승하고, 전투에서 속성별 각성 능력을 쓸 수 있다. */
const AWAKEN_COST = 10;   // 각성에 필요한 비늘 수
const SCALE_PRICE = 500;  // 비늘 1개 가격
const AWAKEN_SKILLS = {
  fire:   { name:"업화 강림",   emoji:"🔥", type:"damageAll", pow:1.15, desc:"적 전체를 불태워 큰 피해를 준다." },
  water:  { name:"생명의 성수", emoji:"💧", type:"healAll",   pow:0.40, desc:"아군 전체의 HP를 크게 회복한다." },
  forest: { name:"세계수 소환", emoji:"🌳", type:"shieldAll", pow:0.60, desc:"거대한 나무를 소환해 아군 전체에 강력한 보호막을 두른다." },
  metal:  { name:"강철 방벽",   emoji:"🛡️", type:"shieldAll", pow:0.38, desc:"아군 전체에 강철 보호막을 부여한다." },
  wind:   { name:"질풍 연무",   emoji:"🌪️", type:"aoeExtra",  pow:0.65, desc:"적 전체에 피해를 주고 즉시 한 번 더 행동한다." },
  void:   { name:"공허 잠식",   emoji:"🌌", type:"voidNuke",  pow:2.4,  desc:"가장 강한 적에게 막대한 피해를 주고 공격력을 약화시킨다." },
  holy:   { name:"부활의 빛",   emoji:"✨", type:"revive",    pow:0.5,  desc:"쓰러진 아군 하나를 되살린다. (없으면 전체 회복)" },
  ancient:{ name:"시간 역행",   emoji:"🏛️", type:"healAll",   pow:0.50, desc:"고대의 힘으로 아군 전체 HP를 크게 되돌린다." },
  earth:  { name:"대지 붕괴",   emoji:"🪨", type:"damageAll", pow:1.30, desc:"대지를 뒤흔들어 적 전체에 막대한 피해를 준다." },
};
// 전투 피해 적용(보호막 우선 흡수)
function applyHit(d, dmg){
  let s = d.shield||0, dd = dmg;
  if(s>0){ const a=Math.min(s,dd); s-=a; dd-=a; }
  return {...d, shield:s, hp:Math.max(0, d.hp-dd)};
}
// 각성 후 영구 능력치 강화
function awakenStats(d){
  const maxHp = Math.round(d.maxHp*1.3);
  return {...d, awakened:true, maxHp, hp:maxHp, atk:Math.round(d.atk*1.25)};
}
// 지원기(회복/보호막) 상승 파티클
function spawnSupport(fx, x, y, color, kind){
  // kind: "shield" = 육각 방패 각인, 그 외 = 치유 상승광
  if(kind==="shield"){
    fxNode(fx,{left:x,top:y,style:{width:"58px",height:"58px",background:color+"33",border:"3px solid "+color,
      boxShadow:"0 0 18px "+color+", inset 0 0 14px "+color,
      clipPath:"polygon(50% 0,95% 25%,95% 75%,50% 100%,5% 75%,5% 25%)"},anim:"fxPop .55s ease-out forwards",life:760});
    fxNode(fx,{left:x,top:y,style:ring(66,color,3),anim:"fxRipple2 .6s ease-out 150ms forwards",life:880});
    sparks(fx,x,y,color,6,34,200,6);
  } else {
    floatUp(fx,x,y,color,9,0);
    fxNode(fx,{left:x,top:y-8,style:emojiStyle(20,color),text:"✚",anim:"fxFloat .8s ease-out 100ms forwards",dx:0,dy:44,life:1000});
    fxNode(fx,{left:x,top:y,style:ring(54,color,4),anim:"fxRipple .6s ease-out forwards",life:700});
    pillarUp(fx,x,y+26,30,70,"linear-gradient(rgba(255,255,255,0),"+color+"66,"+color+"22)",color,60,560);
  }
}

/* ============ 드래곤 SVG 아트 ============
   등급별 체형(새끼용→드레이크→성룡→고룡) + 종별 뿔/가시 변형 + 각성 형상(오라·후광·에너지 날개).
   색은 종의 속성에서 파생: 주속성=몸통, 부속성=날개막/뿔 포인트. */
function shade(hex, f){ // hex 밝기 조절 (f<0 어둡게, f>0 밝게)
  const n=parseInt(hex.slice(1),16); let r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  const t=f<0?0:255, p=Math.abs(f);
  r=Math.round(r+(t-r)*p); g=Math.round(g+(t-g)*p); b=Math.round(b+(t-b)*p);
  return "#"+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}
function DragonArt({sid, awakened, size, dead}){
  const sp = SPECIES_BY_ID[sid] || SPECIES[0];
  const uidStr = React.useId().replace(/[^a-zA-Z0-9]/g,"");
  const v = speciesVariant(sp.sid);
  const g = sp.grade;
  const c1 = ELEMENTS[sp.elems[0]].color;
  const c2 = ELEMENTS[sp.elems[1]||sp.elems[0]].color;
  const body = awakened ? shade(c1,0.18) : c1;
  const bodyD = shade(c1,-0.45);
  const belly = shade(c1,0.62);
  const wingM = shade(c2, awakened?0.25:0);
  const horn  = awakened ? "#fde047" : shade(c2,0.35);
  const eyeC  = awakened ? "#fffbeb" : "#fef08a";
  const S = size||44;
  const gi = {common:0, rare:1, epic:2, legendary:3}[g];
  // 등급별 형태 파라미터
  const spikes = [0,3,5,7][gi];
  const hornN  = [1,1,2,3][gi];
  const wingScale = [0.45,0.8,1.05,1.2][gi];
  const bodyRx = [24,22,21,21][gi], bodyRy=[15,13,12,12][gi];
  const headR = [11,9.5,9,9][gi]; // 새끼용은 머리가 큼
  const spikePts=[]; for(let i=0;i<spikes;i++){ const x=30+i*(30/Math.max(1,spikes-1));
    spikePts.push(<path key={i} d={"M"+x+",46 l3,-"+(7+(i+v)%3*2)+" l3,"+(7+(i+v)%3*2)+" z"} fill={bodyD}/>); }
  const horns=[]; for(let h=0;h<hornN;h++){ const hx=70-h*4, hy=30-h*1.5;
    const bend = (v%3===0)? "c-3,-8 2,-13 7,-14 c-4,4 -3,8 -1,12" : (v%3===1)? "c-1,-9 6,-12 10,-11 c-5,2 -6,6 -6,10" : "c-5,-6 -2,-13 4,-15 c-2,5 -1,9 1,13";
    horns.push(<path key={h} d={"M"+hx+","+hy+" "+bend+" z"} fill={horn} stroke={shade(c2,-0.2)} strokeWidth="0.4"/>); }
  return (
    <svg viewBox="0 0 100 100" width={S} height={S}
      className={dead?"":(awakened?"awk-pulse":"drg-float")}
      style={dead?{filter:"grayscale(1)",opacity:.45}:{}}>
      <defs>
        <linearGradient id={"b"+uidStr} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={body}/><stop offset="1" stopColor={bodyD}/>
        </linearGradient>
        <linearGradient id={"w"+uidStr} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={wingM}/><stop offset="1" stopColor={shade(c2,-0.35)}/>
        </linearGradient>
        <radialGradient id={"a"+uidStr}>
          <stop offset="0" stopColor={shade(c2,0.5)} stopOpacity="0.75"/>
          <stop offset="0.6" stopColor={c2} stopOpacity="0.28"/>
          <stop offset="1" stopColor={c2} stopOpacity="0"/>
        </radialGradient>
      </defs>
      {awakened && <circle cx="50" cy="55" r="46" fill={"url(#a"+uidStr+")"}/>}
      {awakened && <ellipse cx="50" cy="20" rx="17" ry="4.5" fill="none" stroke="#fde047" strokeWidth="2" opacity="0.9"/>}
      {/* 에너지 날개(각성) — 본 날개 뒤 발광막 */}
      {awakened && <path d={"M46,50 C28,10 6,16 12,34 C4,40 10,52 24,52 Z"} fill={shade(c2,0.4)} opacity="0.5"/>}
      {/* 꼬리 */}
      <path d={"M30,62 C12,66 6,76 10,84 C16,80 22,76 30,72 Z"} fill={"url(#b"+uidStr+")"}/>
      {g!=="common" && <path d="M12,80 l-7,6 l9,-1 z" fill={horn}/>}
      {/* 날개 */}
      <g transform={"translate(46,50) scale("+wingScale+") translate(-46,-50)"}>
        <path d="M46,50 C34,16 12,20 18,38 C10,42 16,54 28,52 C34,54 42,54 46,50 Z" fill={"url(#w"+uidStr+")"} stroke={shade(c2,-0.4)} strokeWidth="0.7"/>
        <path d="M46,50 L20,37 M46,50 L27,45 M46,50 L33,51" stroke={shade(c2,-0.4)} strokeWidth="0.9" fill="none"/>
      </g>
      {/* 뒷다리/앞다리 */}
      <path d="M38,68 q-3,9 2,12 l6,-1 q-2,-6 0,-11 z" fill={bodyD}/>
      <path d="M56,70 q-1,8 3,10 l6,-1 q-2,-5 -1,-9 z" fill={bodyD}/>
      {/* 몸통 */}
      <ellipse cx="48" cy="60" rx={bodyRx} ry={bodyRy} fill={"url(#b"+uidStr+")"}/>
      <ellipse cx="50" cy="66" rx={bodyRx*0.62} ry={bodyRy*0.55} fill={belly} opacity="0.9"/>
      {/* 배 비늘 줄 */}
      <path d={"M36,64 q14,8 26,1"} stroke={shade(c1,-0.25)} strokeWidth="0.8" fill="none" opacity="0.6"/>
      {/* 등 가시 */}
      {spikePts}
      {/* 목+머리 */}
      <path d="M60,52 C64,40 68,36 74,34 L82,40 C78,48 72,52 64,56 Z" fill={"url(#b"+uidStr+")"}/>
      <circle cx="74" cy="38" r={headR} fill={"url(#b"+uidStr+")"}/>
      {/* 주둥이/턱 */}
      <path d={"M80,36 Q94,38 93,43 Q86,47 79,45 Z"} fill={body}/>
      <path d={"M80,45 Q88,48 86,50 Q81,50 78,47 Z"} fill={bodyD}/>
      {/* 콧구멍/이빨 */}
      <circle cx="89" cy="41" r="0.9" fill={bodyD}/>
      <path d="M84,45 l1.4,2.4 l1.4,-2.2 z" fill="#ffffff"/>
      {/* 뿔 */}
      {horns}
      {/* 눈 */}
      <ellipse cx="76" cy="37" rx="2.6" ry={g==="common"?3.2:2.4} fill={eyeC}/>
      <ellipse cx="76.6" cy="37" rx="1" ry={g==="common"?2.2:1.6} fill="#1c1917"/>
      {awakened && <ellipse cx="76" cy="37" rx="3.4" ry="3" fill="#fde047" opacity="0.35"/>}
      {/* 전설: 가슴 보석 */}
      {g==="legendary" && <circle cx="52" cy="60" r="3.4" fill={awakened?"#fde047":shade(c2,0.3)} stroke="#fff" strokeWidth="0.6" opacity="0.95"/>}
      {/* 각성 반짝임 */}
      {awakened && <g fill="#fde047"><circle cx="24" cy="30" r="1.3"/><circle cx="88" cy="24" r="1.1"/><circle cx="16" cy="58" r="1"/><circle cx="90" cy="60" r="1.2"/></g>}
    </svg>
  );
}

/* ============ 공용 UI ============ */
function GradeBadge({grade}){
  const g = GRADES[grade];
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
    style={{background:g.color+"22", color:g.color, border:"1px solid "+g.color+"66"}}>{g.name}</span>;
}
function ElemChips({elements, size}){
  const s = size||"text-xs";
  return <div className="flex flex-wrap gap-1">
    {elements.map((e,i)=>(
      <span key={i} className={"px-1.5 py-0.5 rounded-md font-semibold "+s}
        style={{background:ELEMENTS[e].color+"22", color:ELEMENTS[e].color}}>
        {ELEMENTS[e].emoji} {ELEMENTS[e].name}
      </span>
    ))}
  </div>;
}
function StatBar({value, max, color, label}){
  const pct = Math.max(0, Math.min(100, (value/max)*100));
  return <div>
    <div className="flex justify-between text-[10px] text-slate-400 mb-0.5"><span>{label}</span><span>{Math.round(value)}/{max}</span></div>
    <div className="bar"><div style={{width:pct+"%", background:color}}></div></div>
  </div>;
}

/* ============ 보육원 드래곤 카드 ============ */
function NurseryCard({d, onFeed, onClean, selectable, selected, onSelect, disabled, onAwaken, scales}){
  const g = GRADES[d.grade];
  const canAwaken = onAwaken && d.grade==="legendary" && !d.awakened;
  return (
    <div onClick={()=> selectable && !disabled && onSelect && onSelect(d)}
      className={"rounded-2xl p-3 border bg-slate-900/70 fade "+(selected?"ring-2":"")+(selectable&&!disabled?" cursor-pointer hover:bg-slate-800/70":"")+(disabled?" opacity-40":"")}
      style={{borderColor: d.awakened?"#fbbf24":g.color+"55", boxShadow: selected?"0 0 0 2px "+g.color : (d.awakened?"0 0 14px #fbbf2466":"none")}}>
      <div className="flex items-center gap-2 mb-2">
        <div><DragonArt sid={d.sid} awakened={d.awakened} size={52}/></div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-100">{d.name}</span><GradeBadge grade={d.grade}/>
            {d.awakened && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/50">✨각성</span>}
          </div>
          <ElemChips elements={d.elements}/>
        </div>
      </div>
      <div className="space-y-1.5">
        <StatBar value={d.hp} max={d.maxHp} color="#ef4444" label="HP"/>
        <div className="text-[11px] text-amber-300 font-semibold">⚔️ 공격력 {d.atk}</div>
        <StatBar value={d.growth} max={100} color="#22c55e" label="성장도"/>
        <StatBar value={d.fullness} max={100} color="#f59e0b" label="포만감"/>
      </div>
      {onFeed && (
        <div className="flex gap-2 mt-3">
          <button onClick={(e)=>{e.stopPropagation(); onFeed(d);}}
            className="flex-1 text-xs font-bold py-1.5 rounded-lg bg-amber-500/90 hover:bg-amber-400 text-slate-900">🍖 먹이주기 (20G)</button>
          <button onClick={(e)=>{e.stopPropagation(); onClean(d);}}
            className="flex-1 text-xs font-bold py-1.5 rounded-lg bg-sky-500/90 hover:bg-sky-400 text-slate-900">🧹 청소하기</button>
        </div>
      )}
      {canAwaken && (
        <button onClick={(e)=>{e.stopPropagation(); onAwaken(d);}} disabled={(scales||0)<AWAKEN_COST}
          className="w-full mt-2 text-xs font-black py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-900 disabled:opacity-40">
          🌟 각성시키기 (비늘 {scales||0}/{AWAKEN_COST})
        </button>
      )}
      {d.awakened && <div className="mt-2 text-center text-[11px] text-amber-300 font-bold">🌟 각성 완료 · 전투에서 각성기 사용 가능</div>}
      {!d.awakened && d.growth>=100 && <div className="mt-2 text-center text-[11px] text-emerald-400 font-bold">✅ 다 자랐어요! (교배/전투 가능)</div>}
    </div>
  );
}

/* ============ 전투 드래곤 카드 ============ */
const BattleCard = React.forwardRef(({d, isEnemy, selected, targetable, onClick, dead}, ref)=>{
  const g = GRADES[d.grade];
  return (
    <div ref={ref} onClick={onClick}
      className={"rounded-xl p-2 border bg-slate-900/80 transition "+(dead?"opacity-30 grayscale":"")+(targetable?" cursor-crosshair hover:ring-2 hover:ring-red-400":"")+(selected?" ring-2 ring-emerald-400":"")}
      style={{borderColor: d.awakened?"#fbbf24":g.color+"66", boxShadow: d.awakened&&!dead?"0 0 10px #fbbf2455":"none"}}>
      <div className="flex items-center gap-2">
        <div><DragonArt sid={d.sid} awakened={d.awakened} size={40} dead={dead}/></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-bold text-xs text-slate-100 truncate">{d.name}</span><GradeBadge grade={d.grade}/>
            {d.shield>0 && <span className="text-[10px] font-bold text-sky-300 whitespace-nowrap">🛡️{d.shield}</span>}
          </div>
          <ElemChips elements={d.elements} size="text-[10px]"/>
        </div>
      </div>
      <div className="mt-1"><StatBar value={Math.max(0,d.hp)} max={d.maxHp} color={isEnemy?"#f87171":"#34d399"} label="HP"/></div>
    </div>
  );
});

/* ============ 전투 화면 ============ */
function BattleArena({left, right, leftName, rightName, leftIsAI, rightIsAI, onExit, network, incomingAttack}){
  const [L, setL] = useState(()=>left.map(d=>({...d, shield:0})));
  const [R, setR] = useState(()=>right.map(d=>({...d, shield:0})));
  const [turn, setTurn] = useState("left");
  const [selDragon, setSelDragon] = useState(0);
  const [selElem, setSelElem] = useState(null);
  const [selTarget, setSelTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState(["⚔️ 전투 시작!"]);
  const [finished, setFinished] = useState(false);
  const [winner, setWinner] = useState(null);
  const [usedAwaken, setUsedAwaken] = useState([]); // 각성기를 이미 쓴 드래곤 id
  const containerRef = useRef(null);
  const fxRef = useRef(null);
  const cardRefs = useRef({});

  const addLog = m => setLog(l => [m, ...l].slice(0,6));

  // 승패 판정
  useEffect(()=>{
    if(finished) return;
    const lDead = L.every(d=>d.hp<=0), rDead = R.every(d=>d.hp<=0);
    if(rDead || lDead){ setWinner(rDead ? "left":"right"); setFinished(true); }
  }, [L, R, finished]);

  // 턴 전환 시 살아있는 첫 드래곤 선택
  useEffect(()=>{
    const arr = turn==="left"?L:R;
    const idx = arr.findIndex(d=>d.hp>0);
    setSelDragon(idx<0?0:idx); setSelElem(null);
    const enemy = turn==="left"?R:L;
    setSelTarget(enemy.findIndex(d=>d.hp>0));
  }, [turn]);

  // 공격 모션 재생: fx 레이어에 파티클을 그리고, impact 시점에 onImpact 실행. 총 재생시간(ms) 반환.
  function playAttackFx(type, fromEl, toEl, onImpact){
    const cfg = ATTACK_FX[type] || ATTACK_FX.fire;
    const fx = fxRef.current, cont = containerRef.current;
    if(fx && cont && fromEl && toEl){
      const c = cont.getBoundingClientRect();
      const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
      const ax = a.left+a.width/2-c.left, ay = a.top+a.height/2-c.top;
      const tx = b.left+b.width/2-c.left, ty = b.top+b.height/2-c.top;
      try{ cfg.build(fx, ax, ay, tx, ty, ELEMENTS[type] ? ELEMENTS[type].color : "#fff"); }catch(e){}
    }
    setTimeout(onImpact, cfg.impact);
    return cfg.dur;
  }

  function performAttack(side, di, elem, ti, remote){
    setBusy(true);
    const atkArr = side==="left"?L:R;
    const defArr = side==="left"?R:L;
    if(!atkArr[di] || !defArr[ti]){ setBusy(false); return; }
    const calc = remote ? {dmg:remote.dmg, mult:remote.mult} : calcDamage(atkArr[di].atk, elem, defArr[ti].elements);
    const dmg = calc.dmg, mult = calc.mult;
    const type = pickFxType(atkArr[di], elem);
    const moveName = (ATTACK_FX[type] || ATTACK_FX.fire).name;
    const fromEl = cardRefs.current[(side==="left"?"L":"R")+di];
    const toEl = cardRefs.current[(side==="left"?"R":"L")+ti];
    const setDef = side==="left"?setR:setL;
    const atkName = atkArr[di].name, defName = defArr[ti].name;
    const tier = type.endsWith("_awk") ? 2 : type.endsWith("_ult") ? 1 : 0;
    const dur = playAttackFx(type, fromEl, toEl, ()=>{
      setDef(prev=>{ const n=prev.map(d=>({...d})); n[ti]=applyHit(n[ti], dmg); return n; });
      if(toEl){ toEl.classList.add(tier===2?"quake":"shake"); setTimeout(()=>toEl && toEl.classList.remove("shake","quake"),520); }
      // 데미지 숫자 + 상위 티어 임팩트 프레임(전면 섬광·화면 진동)
      const fx=fxRef.current, cont=containerRef.current;
      if(fx && cont && toEl){
        const c=cont.getBoundingClientRect(), b=toEl.getBoundingClientRect();
        const px=b.left+b.width/2-c.left, py=b.top+b.height/2-c.top;
        fxNode(fx,{left:px,top:py,style:{fontSize:(tier===2?30:tier===1?26:21)+"px",fontWeight:"900",
          color:mult>1?"#fbbf24":"#f8fafc", textShadow:"0 0 8px "+(mult>1?"#f59e0b":"#0008")+", 0 2px 3px #000",
          fontFamily:"monospace"}, text:String(dmg)+(mult>1?"!":""), anim:"fxDmg 1s ease-out forwards", life:1100});
        if(tier>0){
          fxNode(fx,{left:c.width/2,top:c.height/2,style:{width:c.width+"px",height:c.height+"px",
            background:"#ffffff",borderRadius:"12px","--fo":tier===2?".5":".3"},anim:"fxScreen .3s ease-out forwards",life:420});
        }
        if(tier===2){ cont.classList.add("quake"); setTimeout(()=>cont.classList.remove("quake"),520); }
      }
      addLog((side==="left"?"🟢 ":"🔴 ")+atkName+"의 «"+moveName+"» → "+defName+" ["+dmg+" 피해"+(mult>1?" · 효과적!":"")+"]");
      if(network && !remote) network.send({kind:"attack", side, di, elem, ti, dmg, mult});
    });
    setTimeout(()=>{ setTurn(side==="left"?"right":"left"); setBusy(false); }, dur+160);
  }

  // 각성기 사용 (전투에서 각성한 드래곤이 속성별 특수 능력 발동)
  function performAwaken(side, di, elem, remote){
    const skill = AWAKEN_SKILLS[elem];
    if(!skill){ return; }
    setBusy(true);
    const allyArr = side==="left"?L:R, enemyArr = side==="left"?R:L;
    const setAlly = side==="left"?setL:setR, setEnemy = side==="left"?setR:setL;
    const caster = allyArr[di];
    if(!caster){ setBusy(false); return; }
    if(!remote) setUsedAwaken(u=> u.includes(caster.id)?u:[...u, caster.id]);
    const casterEl = cardRefs.current[(side==="left"?"L":"R")+di];
    const dmgType = (skill.type==="damageAll"||skill.type==="aoeExtra"||skill.type==="voidNuke");
    // voidNuke 대상: 가장 HP 높은 적
    let nukeIdx = -1;
    if(skill.type==="voidNuke"){ let best=-1; enemyArr.forEach((d,i)=>{ if(d.hp>0 && d.hp>best){best=d.hp; nukeIdx=i;} }); }

    // 이펙트
    const fx=fxRef.current, cont=containerRef.current;
    if(fx && cont && casterEl){
      const c=cont.getBoundingClientRect();
      const centerOf=(el)=>{ const b=el.getBoundingClientRect(); return {x:b.left+b.width/2-c.left, y:b.top+b.height/2-c.top}; };
      const cc=centerOf(casterEl); const col=ELEMENTS[elem].color;
      fxNode(fx,{left:cc.x,top:cc.y,style:emojiStyle(42),text:skill.emoji,anim:"fxPop .6s ease-out forwards",life:720});
      fxNode(fx,{left:cc.x,top:cc.y,style:ring(64,col,5),anim:"fxFlash .5s ease-out forwards",life:600});
      const tgtArr = dmgType ? enemyArr : allyArr;
      const prefix = dmgType ? (side==="left"?"R":"L") : (side==="left"?"L":"R");
      tgtArr.forEach((d,i)=>{
        if(skill.type==="voidNuke" && i!==nukeIdx) return;
        if(d.hp<=0 && skill.type!=="revive") return;
        const el=cardRefs.current[prefix+i]; if(!el) return; const p=centerOf(el);
        if(dmgType){ try{ (ATTACK_FX[elem]||ATTACK_FX.fire).build(fx, cc.x, cc.y, p.x, p.y); }catch(e){} }
        else { spawnSupport(fx, p.x, p.y, col, skill.type==="shieldAll"?"shield":"heal"); }
      });
    }

    const impact = 560, dur = 1150;
    setTimeout(()=>{
      const P = skill.pow;
      if(skill.type==="damageAll" || skill.type==="aoeExtra"){
        const amt = Math.round(caster.atk*P);
        setEnemy(prev=> prev.map(d=> d.hp>0 ? applyHit(d, amt) : d));
      } else if(skill.type==="voidNuke"){
        const amt = Math.round(caster.atk*P);
        setEnemy(prev=> prev.map((d,i)=> i===nukeIdx && d.hp>0 ? {...applyHit(d, amt), atk:Math.max(1,Math.round(d.atk*0.5))} : d));
      } else if(skill.type==="healAll"){
        setAlly(prev=> prev.map(d=> d.hp>0 ? {...d, hp:Math.min(d.maxHp, d.hp+Math.round(d.maxHp*P))} : d));
      } else if(skill.type==="shieldAll"){
        setAlly(prev=> prev.map(d=> d.hp>0 ? {...d, shield:(d.shield||0)+Math.round(d.maxHp*P)} : d));
      } else if(skill.type==="revive"){
        setAlly(prev=>{ const n=prev.map(d=>({...d})); const idx=n.findIndex(d=>d.hp<=0);
          if(idx>=0){ n[idx].hp=Math.round(n[idx].maxHp*P); }
          else { n.forEach(d=>{ if(d.hp>0) d.hp=Math.min(d.maxHp, d.hp+Math.round(d.maxHp*0.3)); }); }
          return n; });
      }
      addLog((side==="left"?"🟢 ":"🔴 ")+caster.name+"의 각성기 ✦"+skill.name+"✦ 발동!");
      if(network && !remote) network.send({kind:"awaken", side, di, elem});
    }, impact);

    const extra = skill.type==="aoeExtra";
    setTimeout(()=>{ if(!extra) setTurn(side==="left"?"right":"left"); setBusy(false); }, dur);
  }

  // AI 자동 행동 (온라인 대전에서는 leftIsAI/rightIsAI가 항상 false라 동작하지 않음)
  useEffect(()=>{
    if(finished || busy) return;
    const aiSide = (turn==="left"&&leftIsAI)||(turn==="right"&&rightIsAI) ? turn : null;
    if(!aiSide) return;
    const t = setTimeout(()=>{
      const atkArr = aiSide==="left"?L:R, defArr = aiSide==="left"?R:L;
      const alive = atkArr.map((d,i)=>({d,i})).filter(x=>x.d.hp>0);
      const targets = defArr.map((d,i)=>({d,i})).filter(x=>x.d.hp>0).sort((a,b)=>a.d.hp-b.d.hp);
      if(!alive.length || !targets.length) return;
      const ch = pick(alive);
      performAttack(aiSide, ch.i, pick(ch.d.elements), targets[0].i);
    }, 800);
    return ()=>clearTimeout(t);
  }, [turn, busy, finished]);

  // 온라인 대전: 상대 기기에서 온 공격을 그대로(같은 피해량으로) 재현
  const lastIncomingRef = useRef(null);
  useEffect(()=>{
    if(!incomingAttack) return;
    if(lastIncomingRef.current === incomingAttack.counter) return;
    lastIncomingRef.current = incomingAttack.counter;
    if(incomingAttack.kind === "awaken"){
      performAwaken(incomingAttack.side, incomingAttack.di, incomingAttack.elem, true);
    } else {
      performAttack(incomingAttack.side, incomingAttack.di, incomingAttack.elem, incomingAttack.ti, incomingAttack);
    }
  }, [incomingAttack]);

  const curIsHuman = network ? (turn===network.mySide) : ((turn==="left"&&!leftIsAI)||(turn==="right"&&!rightIsAI));
  const curArr = turn==="left"?L:R;
  const enemyArr = turn==="left"?R:L;
  const curDragon = curArr[selDragon];

  function humanAttack(){
    if(busy||finished||!curIsHuman) return;
    if(!curDragon||curDragon.hp<=0) return;
    const elem = selElem || curDragon.elements[0];
    let tgt = selTarget;
    if(tgt==null || !enemyArr[tgt] || enemyArr[tgt].hp<=0) tgt = enemyArr.findIndex(d=>d.hp>0);
    if(tgt<0) return;
    performAttack(turn, selDragon, elem, tgt);
  }
  function humanAwaken(){
    if(busy||finished||!curIsHuman) return;
    if(!curDragon||curDragon.hp<=0||!curDragon.awakened) return;
    if(usedAwaken.includes(curDragon.id)) return;
    const elem = selElem || curDragon.elements[0];
    performAwaken(turn, selDragon, elem);
  }
  const curElem = curDragon ? (selElem || curDragon.elements[0]) : null;
  const canAwakenNow = curDragon && curDragon.awakened && !usedAwaken.includes(curDragon.id);

  return (
    <div ref={containerRef} className="relative">
      {/* 공격 이펙트가 그려지는 레이어 (imperative DOM) */}
      <div ref={fxRef} className="fx-layer"></div>

      <div className="grid grid-cols-2 gap-3 md:gap-6">
        <div>
          <div className="text-center font-bold mb-2 text-emerald-400">🟢 {leftName} {turn==="left"&&!finished?"◀ 턴":""}</div>
          <div className="space-y-2">
            {L.map((d,i)=>(
              <BattleCard key={d.id} ref={el=>cardRefs.current["L"+i]=el} d={d} dead={d.hp<=0}
                selected={turn==="left"&&curIsHuman&&selDragon===i}
                targetable={turn==="right"&&curIsHuman&&d.hp>0}
                onClick={()=>{ if(busy)return;
                  if(turn==="left"&&curIsHuman&&d.hp>0) setSelDragon(i);
                  else if(turn==="right"&&curIsHuman&&d.hp>0) setSelTarget(i); }}/>
            ))}
          </div>
        </div>
        <div>
          <div className="text-center font-bold mb-2 text-red-400">🔴 {rightName} {turn==="right"&&!finished?"◀ 턴":""}</div>
          <div className="space-y-2">
            {R.map((d,i)=>(
              <BattleCard key={d.id} ref={el=>cardRefs.current["R"+i]=el} d={d} isEnemy dead={d.hp<=0}
                selected={turn==="right"&&curIsHuman&&selDragon===i}
                targetable={turn==="left"&&curIsHuman&&d.hp>0}
                onClick={()=>{ if(busy)return;
                  if(turn==="right"&&curIsHuman&&d.hp>0) setSelDragon(i);
                  else if(turn==="left"&&curIsHuman&&d.hp>0) setSelTarget(i); }}/>
            ))}
          </div>
        </div>
      </div>

      {/* 컨트롤 */}
      <div className="mt-4 rounded-2xl bg-slate-900/80 border border-slate-700 p-3">
        {finished ? (
          <div className="text-center py-2">
            <div className="text-2xl font-black mb-2">{
              network
              ? (winner===network.mySide ? "🎉 승리!" : "💥 패배했어요...")
              : ((winner==="left"&&!leftIsAI)||(winner==="right"&&!rightIsAI)
                ? "🎉 승리!" : "💥 "+(winner==="left"?leftName:rightName)+" 승리!")}</div>
            <button onClick={()=>onExit(winner)} className="px-6 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 font-bold text-white">돌아가기</button>
          </div>
        ) : curIsHuman ? (
          <div>
            <div className="text-xs text-slate-300 mb-2">
              <b className="text-emerald-400">{turn==="left"?leftName:rightName}</b> 차례 · 공격할 <b>{curDragon?curDragon.name:"-"}</b>의 속성을 고르고, 오른쪽 적을 클릭해 대상을 정하세요.
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {curDragon && curDragon.elements.map(e=>(
                <button key={e} onClick={()=>setSelElem(e)}
                  className={"chip px-3 py-1.5 rounded-lg text-sm font-bold "+((selElem||curDragon.elements[0])===e?"ring-2":"")}
                  style={{background:ELEMENTS[e].color+"33", color:ELEMENTS[e].color, boxShadow:(selElem||curDragon.elements[0])===e?"0 0 0 2px "+ELEMENTS[e].color:"none"}}>
                  {ELEMENTS[e].emoji} {ELEMENTS[e].name}
                </button>
              ))}
            </div>
            {curDragon && (
              <div className="text-[11px] text-slate-400 mb-2">
                🎬 공격 모션: <b className="text-slate-200">{(ATTACK_FX[pickFxType(curDragon, curElem)]||ATTACK_FX.fire).name}</b>
                {curDragon.grade==="legendary" && <span className="text-amber-300">{curDragon.awakened?" (⚡각성 오의!)":" (전설 궁극기!)"}</span>}
                {canAwakenNow && curElem && <span className="text-amber-200"> · 각성기: {AWAKEN_SKILLS[curElem].emoji} {AWAKEN_SKILLS[curElem].name}</span>}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={humanAttack} disabled={busy}
                className={(canAwakenNow?"flex-1 ":"w-full ")+"py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-400 hover:to-orange-400 font-black text-white disabled:opacity-50"}>
                🎯 공격! {selTarget!=null&&enemyArr[selTarget]?"→ "+enemyArr[selTarget].name:""}
              </button>
              {canAwakenNow && curElem && (
                <button onClick={humanAwaken} disabled={busy}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 font-black text-slate-900 disabled:opacity-50">
                  🌟 각성기! ({AWAKEN_SKILLS[curElem].name})
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center text-slate-400 py-3 animate-pulse">
            {network ? "⏳ 상대방의 턴을 기다리는 중..." : "🤖 "+(turn==="left"?leftName:rightName)+" 생각 중..."}
          </div>
        )}
      </div>

      <div className="mt-3 rounded-xl bg-black/40 border border-slate-800 p-2 text-[11px] text-slate-300 space-y-0.5 h-24 overflow-auto">
        {log.map((l,i)=><div key={i} className={i===0?"text-slate-100":""}>{l}</div>)}
      </div>
    </div>
  );
}

/* ============ 메인 앱 ============ */
function Game(){
  const initialSaveRef = useRef(loadSave());
  const initSave = initialSaveRef.current;

  const [tab, setTab] = useState("nursery");
  const [gold, setGold] = useState(()=> initSave ? initSave.gold : 600);
  const [day, setDay] = useState(()=> initSave ? initSave.day : 1);
  const [dragons, setDragons] = useState(()=> initSave ? initSave.dragons.map(migrateDragon) : [
    makeDragonFromSpecies(SPECIES_BY_ID["c01"], true),
    makeDragonFromSpecies(SPECIES_BY_ID["c03"], true),
    makeDragonFromSpecies(SPECIES_BY_ID["r04"], true),
  ]);
  const [eggs, setEggs] = useState(()=> initSave ? initSave.eggs.map(migrateEgg) : []);
  const [dex, setDex] = useState(()=> initSave && initSave.dex ? initSave.dex : {}); // 발견한 종 { sid: true }
  const [scales, setScales] = useState(()=> initSave && initSave.scales ? initSave.scales : 0); // 각성의 비늘
  const [toast, setToast] = useState(null);
  const [evt, setEvt] = useState(null);
  const [saveModal, setSaveModal] = useState(null); // {mode:'export'|'import', code, text}

  const notify = m => { setToast(m); setTimeout(()=>setToast(t=>t===m?null:t), 2200); };

  // 저장 데이터를 불러왔다면 id 카운터가 겹치지 않도록 앞으로 당겨두고, 안내 토스트를 띄운다.
  useEffect(()=>{
    if(!initSave) return;
    const ids = [...initSave.dragons.map(d=>d.id), ...initSave.eggs.map(e=>e.id)];
    if(ids.length) _id = Math.max(_id, Math.max(...ids)+1);
    notify("💾 저장된 게임을 불러왔어요!");
  }, []);

  // 보유/알 드래곤의 종을 도감에 자동 등록 (sid 기준)
  useEffect(()=>{
    setDex(prev=>{
      const next={...prev}; let changed=false;
      dragons.forEach(d=>{ if(d.sid && !next[d.sid]){ next[d.sid]=true; changed=true; } });
      eggs.forEach(e=>{ if(e.sid && !next[e.sid]){ next[e.sid]=true; changed=true; } });
      return changed?next:prev;
    });
  }, [dragons, eggs]);

  // 상태가 바뀔 때마다 이 기기의 브라우저에 자동 저장
  useEffect(()=>{
    saveLocal({gold, day, dragons, eggs, dex, scales});
  }, [gold, day, dragons, eggs, dex, scales]);

  /* ----- 각성 ----- */
  function buyScale(){
    if(gold<SCALE_PRICE){ notify("💰 골드가 부족해요! (500G 필요)"); return; }
    setGold(g=>g-SCALE_PRICE); setScales(s=>s+1);
    notify("🌟 각성의 비늘을 구매했어요!");
  }
  function awaken(d){
    if(d.grade!=="legendary"){ notify("전설 등급만 각성할 수 있어요."); return; }
    if(d.awakened){ notify("이미 각성한 드래곤이에요."); return; }
    if(scales<AWAKEN_COST){ notify("각성의 비늘이 부족해요! ("+scales+"/"+AWAKEN_COST+")"); return; }
    setScales(s=>s-AWAKEN_COST);
    setDragons(ds=>ds.map(x=> x.id===d.id ? awakenStats(x) : x));
    setEvt({title:"각성 성공!", emoji:"🌟", result:d.name+"이(가) 각성했어요! 능력치가 영구 상승하고, 전투에서 속성별 각성기를 사용할 수 있어요. (HP +30%, 공격 +25%)"});
  }

  /* ----- 보육원 ----- */
  function feed(d){
    if(gold<20){ notify("💰 골드가 부족해요!"); return; }
    setGold(g=>g-20);
    setDragons(ds=>ds.map(x=>x.id===d.id?{...x, fullness:Math.min(100,x.fullness+30)}:x));
  }
  function clean(d){
    setDragons(ds=>ds.map(x=>x.id===d.id?{...x, growth:Math.min(100,x.growth+4), fullness:Math.min(100,x.fullness+5)}:x));
    notify("🧹 "+d.name+"의 둥지를 청소했어요!");
  }

  /* ----- 랜덤 이벤트 13종 ----- */
  const EVENTS = [
    { id:1, title:"밀렵꾼의 습격", emoji:"🏹",
      desc:"드래곤을 노리는 밀렵꾼이 나타났어요! 어떻게 할까요?",
      choices:[
        { label:"함정으로 방어 (150G)", run:()=>{ if(gold>=150){setGold(g=>g-150); return "함정으로 밀렵꾼을 쫓아냈어요! (-150G)";} return "골드가 없어 피해를 입었어요..."; } },
        { label:"그냥 버틴다", run:()=>{ const loss=Math.round(gold*0.35); setGold(g=>g-loss); return "밀렵꾼이 골드를 훔쳐갔어요! (-"+loss+"G)"; } },
      ] },
    { id:2, title:"떠돌이 상인", emoji:"🧳",
      desc:"값비싼 영양제를 파는 상인이 방문했어요. 구매하시겠어요?",
      choices:[
        { label:"구매 (200G)", run:()=>{ if(gold>=200){ setGold(g=>g-200); setDragons(ds=>ds.map(x=>({...x, fullness:100, atk:x.atk+3}))); return "모든 드래곤이 배불리 먹고 공격력이 +3 올랐어요!"; } return "골드가 부족해요..."; } },
        { label:"거절", run:()=>"상인은 아쉬워하며 떠났어요." },
      ] },
    { id:3, title:"마을의 후원금", emoji:"🎁", auto:()=>{ setGold(g=>g+300); return "마을에서 후원금 300G를 보내왔어요!"; } },
    { id:4, title:"드래곤 독감 유행", emoji:"🤒", auto:()=>{ setDragons(ds=>ds.map(x=>({...x, fullness:Math.max(0,x.fullness-30)}))); return "독감이 돌아 모든 드래곤의 포만감이 30 감소했어요."; } },
    { id:5, title:"희귀 광맥 발견", emoji:"💎", auto:()=>{ setGold(g=>g+800); return "보육원 뒷산에서 희귀 광맥을 발견! +800G!"; } },
    { id:6, title:"신비한 마법사 방문", emoji:"🧙", auto:()=>{ let nm=""; setDragons(ds=>{ if(!ds.length) return ds; const i=rand(0,ds.length-1); nm=ds[i].name; return ds.map((x,j)=>j===i?{...x, growth:100}:x); }); return "마법사가 드래곤 하나의 성장도를 MAX로 만들었어요!"; } },
    { id:7, title:"알 도둑 침입", emoji:"🥷",
      desc:"수상한 도둑이 알을 노리고 있어요!",
      choices:[
        { label:"함정 설치 (100G)", run:()=>{ if(gold>=100){ setGold(g=>g-100); return "함정으로 알을 지켜냈어요! (-100G)"; } return "막지 못했지만 다행히 놓쳤어요."; } },
        { label:"방치한다", run:()=>{ let lost=false; setEggs(es=>{ if(es.length){lost=true; return es.slice(1);} return es;}); return lost?"알 하나를 도둑맞았어요...":"다행히 훔쳐갈 알이 없었어요."; } },
      ] },
    { id:8, title:"대풍년", emoji:"🌾", auto:()=>{ setDragons(ds=>ds.map(x=>({...x, fullness:100}))); return "대풍년! 모든 드래곤을 공짜로 배불리 먹였어요!"; } },
    { id:9, title:"보육원 시설 고장", emoji:"🔧", auto:()=>{ setGold(g=>Math.max(0,g-150)); return "시설이 고장나 수리비 150G를 지출했어요."; } },
    { id:10, title:"길 잃은 아기 드래곤", emoji:"🐣", auto:()=>{ setDragons(ds=>[...ds, makeDragonFromSpecies(pick(SPECIES_BY_GRADE.common), true)]); return "길 잃은 아기 드래곤(일반)을 새 식구로 맞이했어요!"; } },
    { id:11, title:"고대 유적의 공명", emoji:"🏛️", auto:()=>{ let n=0; setEggs(es=>{ n=es.length; setDragons(ds=>[...ds, ...es.map(e=>makeDragonFromSpecies(SPECIES_BY_ID[e.sid]||resolveSpecies(e.elements,e.grade), false))]); return []; }); return n>0?("고대의 힘으로 알 "+n+"개가 모두 부화했어요!"):"부화할 알이 없었어요."; } },
    { id:12, title:"먹이 창고 오염", emoji:"🦠",
      desc:"먹이 창고가 오염됐어요. 정화하시겠어요?",
      choices:[
        { label:"정화 (120G)", run:()=>{ if(gold>=120){ setGold(g=>g-120); return "창고를 정화했어요! (-120G)"; } return "골드가 없어 정화하지 못했어요..."; } },
        { label:"방치", run:()=>{ setDragons(ds=>ds.map(x=>({...x, fullness:Math.max(0,x.fullness-30)}))); return "오염된 먹이로 포만감이 30 감소했어요."; } },
      ] },
    { id:13, title:"전설 드래곤의 축복", emoji:"🌟", auto:()=>{ setDragons(ds=>ds.map(x=>({...x, maxHp:x.maxHp+30, hp:x.maxHp+30, atk:x.atk+8}))); return "전설의 드래곤이 축복을 내려 모든 드래곤이 영구 강화됐어요! (HP+30, 공격+8)"; } },
  ];

  function nextDay(){
    setDay(d=>d+1);
    // 성장/포만감 처리
    setDragons(ds=>ds.map(x=>{
      let growth=x.growth, hp=x.hp, fullness=x.fullness;
      if(fullness>=40 && growth<100) growth=Math.min(100, growth+rand(9,16));
      if(fullness<20) hp=Math.max(1, hp-rand(5,15));
      fullness=Math.max(0, fullness-rand(15,25));
      return {...x, growth, hp, fullness};
    }));
    // 알 부화 카운트다운
    setEggs(es=>{
      const remain=[]; const hatched=[];
      es.forEach(e=>{ const dl=e.daysLeft-1; if(dl<=0) hatched.push(makeDragonFromSpecies(SPECIES_BY_ID[e.sid]||resolveSpecies(e.elements,e.grade), false)); else remain.push({...e, daysLeft:dl}); });
      if(hatched.length){ setDragons(ds=>[...ds, ...hatched]); setTimeout(()=>notify("🐣 알 "+hatched.length+"개가 부화했어요!"),50); }
      return remain;
    });
    // 30% 이벤트
    if(Math.random()<0.30){
      const e = pick(EVENTS);
      if(e.auto){ const msg=e.auto(); setEvt({title:e.title, emoji:e.emoji, result:msg}); }
      else { setEvt({title:e.title, emoji:e.emoji, desc:e.desc, choices:e.choices}); }
    } else {
      notify("🌙 "+ (day+1) +"일차 · 평화로운 하루가 지났어요.");
    }
  }

  /* ----- 교배 ----- */
  const [breedSel, setBreedSel] = useState([]);
  function toggleBreed(d){
    if(d.growth<100){ notify("아직 다 자라지 않았어요 (성장도 100 필요)"); return; }
    setBreedSel(s=> s.find(x=>x===d.id) ? s.filter(x=>x!==d.id) : (s.length<2 ? [...s, d.id] : [s[1], d.id]));
  }
  function breed(){
    if(breedSel.length!==2){ notify("교배할 드래곤 2마리를 골라주세요."); return; }
    if(gold<100){ notify("교배 비용 100G가 부족해요."); return; }
    const p1 = dragons.find(d=>d.id===breedSel[0]), p2 = dragons.find(d=>d.id===breedSel[1]);
    setGold(g=>g-100);
    let elems = uniq([...p1.elements, ...p2.elements]);
    let mutated=false;
    if(Math.random()<0.22){ const extra=ELEM_KEYS.filter(e=>!elems.includes(e)); if(extra.length){ elems.push(pick(extra)); mutated=true; } }
    if(elems.length>4) elems = sample(elems,4);
    const grade = gradeByCount(elems.length);
    // 부모 속성과 가장 잘 맞는 '종'이 태어난다 — 알의 속성·이름은 종에 고정
    const sp = resolveSpecies(elems, grade);
    setEggs(es=>[...es, { id:uid(), sid:sp.sid, grade:sp.grade, elements:[...sp.elems], daysLeft:rand(2,3) }]);
    setBreedSel([]);
    setEvt({title:"교배 성공!", emoji:"🥚", result:(mutated?"✨ 돌연변이 발생! ":"")+"["+GRADES[sp.grade].name+"] "+sp.name+"의 알이 태어났어요! 속성: "+sp.elems.map(e=>ELEMENTS[e].emoji+ELEMENTS[e].name).join(", ")+" · "+rand(2,3)+"일 뒤 부화 예정."});
  }

  /* ----- AI 투기장 ----- */
  const DIFFS = {
    easy:   { name:"쉬움",   grades:["common","common","common"], mult:1,    reward:200, color:"#22c55e" },
    normal: { name:"중급",   grades:["common","rare","common"],   mult:1,    reward:400, color:"#3b82f6" },
    hard:   { name:"어려움", grades:["rare","rare","epic"],        mult:1.1,  reward:700, color:"#a855f7" },
    legend: { name:"전설",   grades:["epic","epic","legendary"],   mult:1.25, reward:1200, color:"#eab308" },
    myth:   { name:"신화",   grades:["legendary","legendary","legendary"], mult:1.5, reward:2500, color:"#ef4444" },
  };
  const [arenaDiff, setArenaDiff] = useState("easy");
  const [arenaSel, setArenaSel] = useState([]);
  const [battle, setBattle] = useState(null); // {left,right,leftName,rightName,leftIsAI,rightIsAI, ctx}

  function toggleArena(d){
    setArenaSel(s=> s.find(x=>x===d.id) ? s.filter(x=>x!==d.id) : (s.length<3 ? [...s, d.id] : s));
  }
  function startArena(){
    if(arenaSel.length!==3){ notify("출전할 드래곤 3마리를 선택하세요."); return; }
    const my = arenaSel.map(id=>dragons.find(d=>d.id===id));
    const cfg = DIFFS[arenaDiff];
    const enemies = cfg.grades.map(g=>randomDragon(g, cfg.mult));
    setBattle({ left:my, right:enemies, leftName:"내 팀", rightName:"AI ("+cfg.name+")",
      leftIsAI:false, rightIsAI:true, ctx:{type:"arena", diff:arenaDiff} });
  }

  /* ----- 친선전 (Pass & Play) ----- */
  const [fStage, setFStage] = useState("lobby"); // lobby -> p1pick -> p2pick -> battle
  const [roomCode, setRoomCode] = useState("");
  const [p1Deck, setP1Deck] = useState([]);
  const [p2Deck, setP2Deck] = useState([]);

  function makeLocalRoom(){ setRoomCode(String(rand(1000,9999))); setFStage("p1pick"); setP1Deck([]); setP2Deck([]); }
  function joinLocalRoom(){ setRoomCode("2481"); setFStage("p1pick"); setP1Deck([]); setP2Deck([]); }
  function togglePick(deck,setDeck,d){ setDeck(s=> s.find(x=>x===d.id)?s.filter(x=>x!==d.id):(s.length<3?[...s,d.id]:s)); }

  /* ----- 친선전 온라인 (다른 기기, Trystero P2P) ----- */
  const [friendlyMode, setFriendlyMode] = useState("local"); // 'local' | 'online'
  const [netStage, setNetStage] = useState("idle"); // idle -> pick -> waiting -> battle
  const [netRoomCode, setNetRoomCode] = useState("");
  const [netRoomInput, setNetRoomInput] = useState("");
  const [netMySide, setNetMySide] = useState(null); // 'left' | 'right'
  const [netPeerConnected, setNetPeerConnected] = useState(false);
  const [netMyDeck, setNetMyDeck] = useState([]); // 내 dragons 중 선택한 id들
  const [netMyDeckObjs, setNetMyDeckObjs] = useState(null); // 전송한 시점의 덱 객체 스냅샷
  const [netPeerDeckObjs, setNetPeerDeckObjs] = useState(null); // 상대에게서 받은 덱 객체
  const [incomingAttack, setIncomingAttack] = useState(null);
  const netRef = useRef({});

  function netSetupRoom(code, mySide){
    setNetRoomCode(code); setNetMySide(mySide); setNetStage("pick");
    setNetMyDeck([]); setNetMyDeckObjs(null); setNetPeerDeckObjs(null); setNetPeerConnected(false);
    ensureTrystero(t=>{
      const room = t.joinRoom({appId:"yunny-dragon-nursery-v1"}, "ynd-"+code);
      // 이 버전의 trystero는 makeAction이 [send, onMessage] 튜플이 아니라
      // {send, onMessage(getter/setter)} 객체 하나를 반환하고,
      // onPeerJoin/onPeerLeave도 함수 호출이 아니라 프로퍼티 대입으로 등록한다.
      const deckAction = room.makeAction("deck");
      const atkAction = room.makeAction("atk");
      netRef.current = {room, sendDeck: deckAction.send, sendAtk: atkAction.send};
      room.onPeerJoin = ()=> setNetPeerConnected(true);
      room.onPeerLeave = ()=> notify("상대방의 연결이 끊겼어요.");
      deckAction.onMessage = deck=> setNetPeerDeckObjs(deck);
      atkAction.onMessage = action=> setIncomingAttack({...action, counter: Date.now()+Math.random()});
    });
  }
  function netHost(){ netSetupRoom(Math.random().toString(36).slice(2,8).toUpperCase(), "left"); }
  function netJoin(){
    const code = netRoomInput.trim().toUpperCase();
    if(!code){ notify("방 코드를 입력하세요."); return; }
    netSetupRoom(code, "right");
  }
  function netLeaveRoom(){
    if(netRef.current.room) netRef.current.room.leave();
    netRef.current = {};
    setNetStage("idle"); setNetRoomCode(""); setNetRoomInput(""); setNetMySide(null);
    setNetPeerConnected(false); setNetMyDeck([]); setNetMyDeckObjs(null); setNetPeerDeckObjs(null);
  }
  function sendMyDeck(){
    if(netMyDeck.length!==3){ notify("드래곤 3마리를 선택하세요."); return; }
    const deckObjs = netMyDeck.map(id=>dragons.find(d=>d.id===id));
    setNetMyDeckObjs(deckObjs);
    netRef.current.sendDeck && netRef.current.sendDeck(deckObjs);
    setNetStage("waiting");
  }
  // 양쪽 덱이 모두 준비되면 자동으로 전투 시작
  useEffect(()=>{
    if(netStage==="waiting" && netPeerDeckObjs && netMyDeckObjs){
      const left = netMySide==="left" ? netMyDeckObjs : netPeerDeckObjs;
      const right = netMySide==="left" ? netPeerDeckObjs : netMyDeckObjs;
      setBattle({ left, right, leftName: netMySide==="left"?"나":"상대", rightName: netMySide==="right"?"나":"상대",
        leftIsAI:false, rightIsAI:false,
        network:{ mySide: netMySide, send: action => netRef.current.sendAtk && netRef.current.sendAtk(action) },
        ctx:{type:"online"} });
      setNetStage("battle");
    }
  }, [netStage, netPeerDeckObjs, netMyDeckObjs]);

  function endBattle(winner){
    const ctx = battle.ctx;
    if(ctx.type==="arena"){
      if(winner==="left"){ const r=DIFFS[ctx.diff].reward; setGold(g=>g+r); setDragons(ds=>ds.map(x=> arenaSel.includes(x.id)?{...x, hp:x.maxHp}:x)); notify("🏆 승리! 보상 "+r+"G 획득!"); }
      else notify("패배했어요... 다시 도전해봐요!");
      setArenaSel([]);
    } else if(ctx.type==="online"){
      notify(winner===netMySide ? "🎉 승리!" : "💥 패배했어요...");
      netLeaveRoom();
    } else {
      notify(winner==="left"?"🎉 1P 승리!":"🎉 2P 승리!");
      setFStage("lobby"); setP1Deck([]); setP2Deck([]);
    }
    setBattle(null);
  }

  const grown = dragons.filter(d=>d.growth>=100);

  /* ============ 렌더 ============ */
  if(battle){
    return (
      <div className="max-w-4xl mx-auto p-3">
        <BattleArena {...battle} onExit={endBattle} incomingAttack={incomingAttack}/>
      </div>
    );
  }

  const TABS = [
    { k:"nursery",  label:"보육원",   emoji:"🏡" },
    { k:"breeding", label:"교배소",   emoji:"🥚" },
    { k:"arena",    label:"AI 투기장", emoji:"⚔️" },
    { k:"friendly", label:"친선전",   emoji:"🤝" },
    { k:"codex",    label:"도감",     emoji:"📖" },
  ];

  return (
    <div className="max-w-5xl mx-auto p-3 text-slate-100">
      {/* 상단바 */}
      <div className="flex items-center justify-between rounded-2xl bg-slate-900/80 border border-slate-700 px-4 py-2 mb-3">
        <div className="font-black text-lg bg-gradient-to-r from-amber-300 to-pink-400 bg-clip-text text-transparent">🐉 드래곤 보육원 & 배틀 RPG</div>
        <div className="flex items-center gap-3 text-sm font-bold">
          <span className="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-300">💰 {gold.toLocaleString()} G</span>
          <span className="px-3 py-1 rounded-lg bg-sky-500/20 text-sky-300">📅 {day}일차</span>
          <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300">🐲 {dragons.length}마리</span>
          <span className="px-3 py-1 rounded-lg bg-yellow-500/20 text-yellow-300">🌟 비늘 {scales}</span>
          <button onClick={()=>setSaveModal({mode:"export", code: encodeSave({gold,day,dragons,eggs,dex,scales})})}
            className="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs">💾 내보내기</button>
          <button onClick={()=>setSaveModal({mode:"import", text:""})}
            className="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs">📥 불러오기</button>
        </div>
      </div>

      {/* 탭 */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {TABS.map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            className={"py-2 rounded-xl font-bold text-sm transition "+(tab===t.k?"bg-indigo-500 text-white shadow-lg":"bg-slate-800 text-slate-300 hover:bg-slate-700")}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* 보육원 */}
      {tab==="nursery" && (
        <div className="fade">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-200">🏡 보육원 · 드래곤 {dragons.length}마리 / 알 {eggs.length}개</h2>
            <button onClick={nextDay}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 font-black text-white shadow-lg">
              🌙 다음 날로 →
            </button>
          </div>
          {eggs.length>0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {eggs.map(e=>(
                <div key={e.id} className="rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm flex items-center gap-2">
                  <span className="text-2xl">🥚</span>
                  <div><div className="flex items-center gap-1"><span className="text-xs font-bold text-slate-200">{(SPECIES_BY_ID[e.sid]||{}).name||"?"}</span><GradeBadge grade={e.grade}/></div><div className="text-[10px] text-slate-400 mt-0.5">부화까지 {e.daysLeft}일</div></div>
                </div>
              ))}
            </div>
          )}
          {/* 각성소 */}
          <div className="rounded-2xl bg-gradient-to-r from-amber-900/30 to-yellow-900/20 border border-amber-500/40 p-3 mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              <span className="font-bold text-amber-300">🌟 각성소</span>
              <span className="text-slate-300"> · 각성의 비늘 <b className="text-yellow-300">{scales}개</b> 보유 · 전설 등급을 비늘 {AWAKEN_COST}개로 각성!</span>
            </div>
            <button onClick={buyScale} disabled={gold<SCALE_PRICE}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 font-black text-slate-900 disabled:opacity-40">
              🌟 각성의 비늘 구매 ({SCALE_PRICE}G)
            </button>
          </div>
          <div className="grid md:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-3">
            {dragons.map(d=><NurseryCard key={d.id} d={d} onFeed={feed} onClean={clean} onAwaken={awaken} scales={scales}/>)}
          </div>
        </div>
      )}

      {/* 교배소 */}
      {tab==="breeding" && (
        <div className="fade">
          <h2 className="font-bold text-slate-200 mb-1">🥚 교배소</h2>
          <p className="text-xs text-slate-400 mb-3">다 자란(성장도 100) 드래곤 2마리를 선택해 교배하세요. 부모의 속성이 합쳐지고, 확률적으로 돌연변이가 일어나 더 높은 등급의 알이 태어나요! (비용 100G)</p>
          <div className="grid md:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-3 mb-4">
            {dragons.map(d=>(
              <NurseryCard key={d.id} d={d} selectable selected={breedSel.includes(d.id)} disabled={d.growth<100}
                onSelect={()=>toggleBreed(d)}/>
            ))}
          </div>
          <button onClick={breed} disabled={breedSel.length!==2}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 font-black text-white disabled:opacity-40">
            💞 교배하기 ({breedSel.length}/2 선택됨)
          </button>
        </div>
      )}

      {/* AI 투기장 */}
      {tab==="arena" && (
        <div className="fade">
          <h2 className="font-bold text-slate-200 mb-1">⚔️ AI 투기장 (3 vs 3)</h2>
          <p className="text-xs text-slate-400 mb-3">난이도를 고르고 출전할 드래곤 3마리를 선택하세요. 어려울수록 AI가 강하지만 보상도 커요!</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {Object.entries(DIFFS).map(([k,v])=>(
              <button key={k} onClick={()=>setArenaDiff(k)}
                className={"px-4 py-2 rounded-xl font-bold text-sm border-2 transition "+(arenaDiff===k?"text-white":"text-slate-300 border-transparent bg-slate-800")}
                style={arenaDiff===k?{background:v.color+"33", borderColor:v.color, color:v.color}:{}}>
                {v.name} <span className="text-[10px] opacity-80">· {v.reward}G</span>
              </button>
            ))}
          </div>
          <div className="grid md:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-3 mb-4">
            {dragons.map(d=>(
              <NurseryCard key={d.id} d={d} selectable selected={arenaSel.includes(d.id)}
                disabled={!arenaSel.includes(d.id)&&arenaSel.length>=3}
                onSelect={()=>toggleArena(d)}/>
            ))}
          </div>
          <button onClick={startArena} disabled={arenaSel.length!==3}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-400 font-black text-white disabled:opacity-40">
            🔥 전투 시작! ({arenaSel.length}/3 출전)
          </button>
        </div>
      )}

      {/* 친선전 */}
      {tab==="friendly" && (
        <div className="fade">
          <h2 className="font-bold text-slate-200 mb-1">🤝 친선전</h2>
          <div className="flex gap-2 mb-4">
            <button onClick={()=>setFriendlyMode("local")}
              className={"flex-1 py-2 rounded-xl font-bold text-sm "+(friendlyMode==="local"?"bg-indigo-500 text-white":"bg-slate-800 text-slate-300 hover:bg-slate-700")}>
              📱 로컬 2인 (한 기기)
            </button>
            <button onClick={()=>setFriendlyMode("online")}
              className={"flex-1 py-2 rounded-xl font-bold text-sm "+(friendlyMode==="online"?"bg-indigo-500 text-white":"bg-slate-800 text-slate-300 hover:bg-slate-700")}>
              🌐 온라인 대전 (다른 기기)
            </button>
          </div>

          {friendlyMode==="local" && (
            <div>
              {fStage==="lobby" && (
                <div className="mt-2 grid sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-slate-800/70 border border-slate-700 p-5 text-center">
                    <div className="text-4xl mb-2">🏠</div><div className="font-bold mb-2">방 만들기</div>
                    <p className="text-xs text-slate-400 mb-3">새 방을 만들고 친구에게 코드를 알려주세요.</p>
                    <button onClick={makeLocalRoom} className="w-full py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 font-bold">방 만들기</button>
                  </div>
                  <div className="rounded-2xl bg-slate-800/70 border border-slate-700 p-5 text-center">
                    <div className="text-4xl mb-2">🔑</div><div className="font-bold mb-2">참여하기</div>
                    <p className="text-xs text-slate-400 mb-3">한 기기에서 번갈아 조작하는 로컬 대전이에요.</p>
                    <button onClick={joinLocalRoom} className="w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 font-bold text-slate-900">참여하기</button>
                  </div>
                </div>
              )}
              {(fStage==="p1pick"||fStage==="p2pick") && (
                <div className="mt-3">
                  <div className="rounded-xl bg-slate-800/70 border border-slate-700 px-4 py-2 mb-3 text-sm flex items-center justify-between">
                    <span>🔑 방 코드: <b className="text-amber-300">{roomCode}</b></span>
                    <span className="font-bold text-emerald-300">{fStage==="p1pick"?"1P":"2P"} 덱 구성 중...</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">{fStage==="p1pick"?"1P":"2P"}가 사용할 드래곤 3마리를 선택하세요. (기기를 넘겨가며 진행)</p>
                  <div className="grid md:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-3 mb-4">
                    {dragons.map(d=>{
                      const deck = fStage==="p1pick"?p1Deck:p2Deck;
                      return <NurseryCard key={d.id} d={d} selectable selected={deck.includes(d.id)}
                        disabled={!deck.includes(d.id)&&deck.length>=3}
                        onSelect={()=> fStage==="p1pick"? togglePick(p1Deck,setP1Deck,d) : togglePick(p2Deck,setP2Deck,d)}/>;
                    })}
                  </div>
                  {fStage==="p1pick" ? (
                    <button onClick={()=>setFStage("p2pick")} disabled={p1Deck.length!==3}
                      className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 font-black text-slate-900 disabled:opacity-40">
                      1P 완료 → 2P에게 넘기기 ({p1Deck.length}/3)
                    </button>
                  ) : (
                    <button onClick={()=>{
                        const l=p1Deck.map(id=>dragons.find(d=>d.id===id));
                        const r=p2Deck.map(id=>dragons.find(d=>d.id===id));
                        setBattle({ left:l, right:r, leftName:"1P", rightName:"2P", leftIsAI:false, rightIsAI:false, ctx:{type:"friendly"} });
                        setFStage("battle");
                      }} disabled={p2Deck.length!==3}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 font-black text-white disabled:opacity-40">
                      ⚔️ 대전 시작! ({p2Deck.length}/3)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {friendlyMode==="online" && (
            <div>
              <p className="text-xs text-slate-400 mb-3">서버 없이 브라우저끼리 직접 연결돼요. 한쪽이 방을 만들고, 생성된 코드를 카톡 등으로 상대에게 알려주면 서로 다른 기기에서 실시간으로 싸울 수 있어요.</p>
              {netStage==="idle" && (
                <div className="mt-2 grid sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-slate-800/70 border border-slate-700 p-5 text-center">
                    <div className="text-4xl mb-2">🌐</div><div className="font-bold mb-2">방 만들기</div>
                    <p className="text-xs text-slate-400 mb-3">새 방을 만들고 생성된 코드를 상대에게 알려주세요.</p>
                    <button onClick={netHost} className="w-full py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 font-bold">방 만들기</button>
                  </div>
                  <div className="rounded-2xl bg-slate-800/70 border border-slate-700 p-5 text-center">
                    <div className="text-4xl mb-2">🔑</div><div className="font-bold mb-2">참여하기</div>
                    <input value={netRoomInput} onChange={e=>setNetRoomInput(e.target.value)} placeholder="방 코드 입력"
                      className="w-full mb-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-center font-bold tracking-widest text-slate-100 uppercase"/>
                    <button onClick={netJoin} className="w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 font-bold text-slate-900">참여하기</button>
                  </div>
                </div>
              )}
              {netStage==="pick" && (
                <div className="mt-3">
                  <div className="rounded-xl bg-slate-800/70 border border-slate-700 px-4 py-2 mb-3 text-sm flex items-center justify-between">
                    <span>🔑 방 코드: <b className="text-amber-300">{netRoomCode}</b></span>
                    <span className={"font-bold "+(netPeerConnected?"text-emerald-300":"text-amber-300 animate-pulse")}>
                      {netPeerConnected ? "✅ 상대 연결됨" : "⏳ 상대 연결 대기 중..."}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">사용할 드래곤 3마리를 선택하고 덱을 보내세요.</p>
                  <div className="grid md:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-3 mb-4">
                    {dragons.map(d=>(
                      <NurseryCard key={d.id} d={d} selectable selected={netMyDeck.includes(d.id)}
                        disabled={!netMyDeck.includes(d.id)&&netMyDeck.length>=3}
                        onSelect={()=> setNetMyDeck(s=> s.includes(d.id)? s.filter(x=>x!==d.id) : (s.length<3?[...s,d.id]:s))}/>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={netLeaveRoom} className="px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold text-sm">나가기</button>
                    <button onClick={sendMyDeck} disabled={netMyDeck.length!==3}
                      className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 font-black text-white disabled:opacity-40">
                      📤 덱 보내기 ({netMyDeck.length}/3)
                    </button>
                  </div>
                </div>
              )}
              {netStage==="waiting" && (
                <div className="mt-6 text-center text-slate-300">
                  <div className="text-4xl mb-3 animate-pulse">⏳</div>
                  <p>상대방이 덱을 고르는 중이에요... 잠시만 기다려주세요.</p>
                  <button onClick={netLeaveRoom} className="mt-4 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm">취소하고 나가기</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 도감 */}
      {tab==="codex" && (
        <div className="fade">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-slate-200">📖 드래곤 도감</h2>
            <span className="text-sm font-bold text-amber-300">발견 {Object.keys(dex).filter(k=>SPECIES_BY_ID[k]).length} / {SPECIES.length}종</span>
          </div>
          <p className="text-xs text-slate-400 mb-4">등급마다 10종, 총 40종의 드래곤이 살고 있어요. <b className="text-slate-200">종의 속성은 영원히 고정</b> — 같은 종이면 언제나 같은 속성이에요. 교배로 새 종을 발견해 도감을 완성하세요!</p>
          {["legendary","epic","rare","common"].map(gr=>(
            <div key={gr} className="mb-5">
              <h3 className="font-bold text-sm mb-2" style={{color:GRADES[gr].color}}>
                {gr==="legendary"?"🐲":gr==="epic"?"🐉":gr==="rare"?"🐊":"🦎"} {GRADES[gr].name} 등급 ({SPECIES_BY_GRADE[gr].filter(s=>dex[s.sid]).length}/10)
              </h3>
              <div className="grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-3">
                {SPECIES_BY_GRADE[gr].map(s=>{
                  const disc = !!dex[s.sid];
                  return (
                    <div key={s.sid} className="rounded-xl p-3 border bg-slate-900/70" style={{borderColor:GRADES[gr].color+(disc?"88":"33"), opacity:disc?1:0.5}}>
                      <div className="flex items-center gap-2 mb-1">
                        <div>{disc ? <DragonArt sid={s.sid} size={48}/> : <div className="w-12 h-12 flex items-center justify-center text-2xl">🔒</div>}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2"><span className="font-bold text-slate-100">{disc?s.name:"???"}</span><GradeBadge grade={gr}/></div>
                          <ElemChips elements={s.elems}/>
                        </div>
                        {disc && gr==="legendary" && (
                          <div className="text-center">
                            <DragonArt sid={s.sid} awakened size={44}/>
                            <div className="text-[9px] text-amber-300 font-bold">각성 형상</div>
                          </div>
                        )}
                      </div>
                      {disc && <div className="text-[11px] text-slate-400">❤️ 기본 HP ~{GRADES[gr].hp} · ⚔️ 기본 공격 ~{GRADES[gr].atk} · 🎬 {ATTACK_FX[s.elems[0]].name}{s.elems.length>1?" 외 "+(s.elems.length-1)+"종":""}</div>}
                      {disc && gr==="legendary" && (
                        <div className="mt-2 text-[11px] border-t border-slate-700 pt-2">
                          <div className="text-amber-300 font-bold mb-1">🌟 궁극기 / ⚡ 각성 공격</div>
                          {s.elems.map(el=>(
                            <div key={el} style={{color:ELEMENTS[el].color}}>
                              {ELEMENTS[el].emoji} {ultNameFor(el)} <span className="text-amber-200">→ ⚡{awkNameFor(el)}</span>
                            </div>
                          ))}
                          <div className="text-amber-200 font-bold mt-2 mb-1">✨ 각성기</div>
                          {s.elems.map(el=>(
                            <div key={el} className="text-slate-300"><span style={{color:ELEMENTS[el].color}}>{AWAKEN_SKILLS[el].emoji} {AWAKEN_SKILLS[el].name}</span> — {AWAKEN_SKILLS[el].desc}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 토스트 */}
      {toast && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl bg-slate-100 text-slate-900 font-bold shadow-2xl fade">{toast}</div>}

      {/* 이벤트 모달 */}
      {evt && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="rounded-2xl bg-slate-900 border-2 border-indigo-500/60 max-w-md w-full p-6 fade shadow-2xl">
            <div className="text-center text-5xl mb-2">{evt.emoji}</div>
            <div className="text-center text-xl font-black mb-3 text-indigo-300">{evt.title}</div>
            {evt.desc && <p className="text-center text-sm text-slate-300 mb-4">{evt.desc}</p>}
            {evt.result && <p className="text-center text-sm text-emerald-300 mb-4 font-semibold">{evt.result}</p>}
            {evt.choices ? (
              <div className="flex flex-col gap-2">
                {evt.choices.map((c,i)=>(
                  <button key={i} onClick={()=>{ const msg=c.run(); setEvt({title:evt.title, emoji:evt.emoji, result:msg}); }}
                    className="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 font-bold text-white">{c.label}</button>
                ))}
              </div>
            ) : (
              <button onClick={()=>setEvt(null)} className="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 font-bold text-white">확인</button>
            )}
          </div>
        </div>
      )}

      {/* 저장 내보내기 / 불러오기 모달 */}
      {saveModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="rounded-2xl bg-slate-900 border-2 border-indigo-500/60 max-w-lg w-full p-6 fade shadow-2xl">
            {saveModal.mode==="export" ? (
              <div>
                <div className="text-center text-3xl mb-2">💾</div>
                <div className="text-center text-lg font-black mb-3 text-indigo-300">저장 코드 내보내기</div>
                <p className="text-xs text-slate-400 mb-2">이 코드를 복사해서 다른 기기의 "📥 불러오기"에 붙여넣으면 진행 상황이 그대로 옮겨져요. (이 기기에는 이미 자동 저장되어 있어요)</p>
                <textarea readOnly value={saveModal.code} onFocus={e=>e.target.select()}
                  className="w-full h-32 p-2 rounded-lg bg-slate-950 border border-slate-700 text-[11px] text-slate-300 font-mono mb-3"/>
                <div className="flex gap-2">
                  <button onClick={()=>{
                      const ta=document.createElement("textarea"); ta.value=saveModal.code;
                      document.body.appendChild(ta); ta.select();
                      try{ document.execCommand("copy"); notify("📋 복사했어요!"); }catch(e){ notify("복사에 실패했어요. 직접 선택해서 복사해주세요."); }
                      document.body.removeChild(ta);
                    }} className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 font-bold text-white">📋 복사하기</button>
                  <button onClick={()=>setSaveModal(null)} className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold text-white">닫기</button>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-center text-3xl mb-2">📥</div>
                <div className="text-center text-lg font-black mb-3 text-indigo-300">저장 코드 불러오기</div>
                <p className="text-xs text-slate-400 mb-2">다른 기기에서 "💾 내보내기"로 받은 코드를 붙여넣으세요. 현재 진행 상황을 덮어써요.</p>
                <textarea value={saveModal.text} onChange={e=>setSaveModal(m=>({...m, text:e.target.value}))}
                  placeholder="여기에 저장 코드를 붙여넣으세요"
                  className="w-full h-32 p-2 rounded-lg bg-slate-950 border border-slate-700 text-[11px] text-slate-300 font-mono mb-3"/>
                <div className="flex gap-2">
                  <button onClick={()=>{
                      try{
                        const obj = decodeSave(saveModal.text);
                        const ids=[...obj.dragons.map(d=>d.id), ...obj.eggs.map(e=>e.id)];
                        if(ids.length) _id = Math.max(_id, Math.max(...ids)+1);
                        setGold(obj.gold); setDay(obj.day); setDragons(obj.dragons.map(migrateDragon)); setEggs(obj.eggs.map(migrateEgg));
                        if(obj.dex) setDex(obj.dex);
                        setScales(obj.scales||0);
                        setSaveModal(null); notify("✅ 불러오기 완료!");
                      }catch(e){ notify("코드가 올바르지 않아요. 다시 확인해주세요."); }
                    }} className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 font-bold text-white">불러오기</button>
                  <button onClick={()=>setSaveModal(null)} className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold text-white">닫기</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Game/>);
</script>
</body>
</html>'''


def dragon_nursery_page():
    st.title("🐉 드래곤 보육원 & 배틀 RPG")
    st.caption("React + Tailwind로 만든 게임 · 먹이 주고 → 교배하고 → 3v3로 싸워보자! (보육원/교배소/AI 투기장/친선전)")
    components.html(DRAGON_GAME_HTML, height=940, scrolling=True)


# ==========================================
# 7-3. 드래곤 라이더 액션 (React 임베드)
# ==========================================
DRAGON_RIDER_HTML = r'''<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<script src="https://cdn.tailwindcss.com"></script>
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script>
  Babel.registerPreset('classic-react', { presets: [[Babel.availablePresets['react'], { runtime: 'classic' }]] });
</script>
<style>
  html,body{margin:0;padding:0;background:#05070f;overflow-x:hidden;font-family:ui-sans-serif,system-ui,'Segoe UI',sans-serif;}
  #root{min-height:100vh;}
  .glass{background:rgba(15,23,42,.6);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.1);}
  .pop{animation:pop .32s cubic-bezier(.2,1.4,.4,1);}
  @keyframes pop{from{transform:scale(.72);opacity:0}to{transform:scale(1);opacity:1}}
  .cardin{animation:cardin .42s cubic-bezier(.2,1.3,.4,1) backwards;}
  @keyframes cardin{from{transform:translateY(30px) scale(.9);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}
  canvas{display:block;border-radius:14px;cursor:none;}
  .btng{transition:transform .12s, filter .12s, box-shadow .12s;}
  .btng:hover{transform:translateY(-4px) scale(1.03);filter:brightness(1.15);}
  .bosswarn{animation:bw .5s ease-in-out infinite alternate;}
  @keyframes bw{from{opacity:.5;transform:scale(.985)}to{opacity:1;transform:scale(1)}}
  .awkglow{animation:ag 1.4s ease-in-out infinite alternate;}
  @keyframes ag{from{box-shadow:0 0 6px #fbbf24aa}to{box-shadow:0 0 20px #fbbf24}}
  .lvlflash{animation:lf .8s ease-out forwards;}
  @keyframes lf{0%{opacity:.85}100%{opacity:0}}
  .combopop{animation:cp .25s cubic-bezier(.2,1.6,.4,1);}
  @keyframes cp{from{transform:scale(1.6)}to{transform:scale(1)}}
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel" data-presets="classic-react">
const { useState, useRef, useEffect, useCallback } = React;

/* ===================== 상수 ===================== */
const W=780, H=540;
const BOSS_AT=240;
const ELE = {
  fire:{c:"#ef4444",g:"#fca5a5"}, water:{c:"#3b82f6",g:"#93c5fd"}, forest:{c:"#22c55e",g:"#86efac"},
  metal:{c:"#9ca3af",g:"#e5e7eb"}, wind:{c:"#38bdf8",g:"#bae6fd"}, void:{c:"#a855f7",g:"#d8b4fe"},
  holy:{c:"#eab308",g:"#fde68a"}, ancient:{c:"#b45309",g:"#fcd34d"}, earth:{c:"#92400e",g:"#d6a878"},
};
const EKEYS=Object.keys(ELE);
const rand=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const d2=(ax,ay,bx,by)=>{const dx=ax-bx,dy=ay-by;return dx*dx+dy*dy;};

/* ===================== 스킬 도감 ===================== */
const SKILLS = {
  breath: { name:"화염 브레스", icon:"🔥", el:"fire",
    lvTxt:["조준 방향 화염탄 2발","화염탄 +1 · 피해 +25%","화염탄 +1 · 연사 +20%","화염탄 +1 · 피해 +30%","화염탄 +1 · 관통 +1"],
    awkName:"겁화룡염폭풍", awkTxt:"조준 방향 절반을 뒤덮는 화염 폭풍 · 피해 5배 · 완전 관통" },
  tail: { name:"드래곤 테일", icon:"🪨", el:"earth",
    lvTxt:["주변 꼬리 휩쓸기 · 넉백","범위 +20%","피해 +35% · 넉백 강화","주기 -20%","범위 +25% · 피해 +30%"],
    awkName:"대지진 압살파", awkTxt:"3중 지진 충격파가 전 방향으로 확산하며 적을 압살" },
  souls: { name:"추적 원혼", icon:"🌌", el:"void",
    lvTxt:["유도 원혼 2발","원혼 +1","원혼 +1 · 피해 +30%","원혼 +1 · 유도 강화","원혼 +2"],
    awkName:"명계 원혼 레이저", awkTxt:"24갈래 원혼 레이저가 사방으로 쏟아진다 · 즉발 관통" },
  frost: { name:"서리 파도", icon:"💧", el:"water",
    lvTxt:["조준 방향 냉기 파도 · 둔화","파도 폭 +30%","피해 +35% · 둔화 연장","주기 -20%","파도 2연발"],
    awkName:"절대영도 해일", awkTxt:"전 방향 빙결 해일 · 적 전체 강둔화 + 대피해" },
  orbit: { name:"신성 궤도체", icon:"✨", el:"holy",
    lvTxt:["수호 구체 2개 회전","구체 +1","피해 +35% · 회전 +","구체 +1 · 반경 +","구체 +1 · 피해 +40%"],
    awkName:"천상의 심판륜", awkTxt:"6개의 대형 빛날이 고속 회전 + 주기적 성광 파동" },
  blades: { name:"질풍 칼날", icon:"🌪️", el:"wind",
    lvTxt:["조준 방향 부메랑 칼날","칼날 +1","피해 +30% · 관통 +","칼날 +1","칼날 +1 · 피해 +35%"],
    awkName:"폭풍의 눈", awkTxt:"조준 지점에 적을 빨아들이는 거대 태풍 소환" },
  spikes: { name:"강철 가시", icon:"⚙️", el:"metal",
    lvTxt:["사방 가시 6발","가시 +2","피해 +30%","가시 +2 · 주기 -15%","가시 +4"],
    awkName:"천공 강철폭우", awkTxt:"하늘에서 강철 가시 30발이 적들 머리 위로 쏟아진다" },
  rune: { name:"고대 룬", icon:"🏛️", el:"ancient",
    lvTxt:["폭발 룬 설치","폭발 범위 +25%","피해 +40%","룬 2개 동시 설치","폭발 범위 +30% · 피해 +30%"],
    awkName:"창세 룬 연쇄붕괴", awkTxt:"5개의 대형 룬이 연쇄 폭발하며 대지를 갈아엎는다" },
};
const SKEYS=Object.keys(SKILLS);

/* ===================== 게임 ===================== */
function Game(){
  const cvRef=useRef(null);
  const P=useRef(null);
  const sk=useRef({});
  const enemies=useRef([]), projs=useRef([]), beams=useRef([]), novas=useRef([]), zones=useRef([]),
        ebullets=useRef([]), gems=useRef([]), parts=useRef([]), floats=useRef([]), deaths=useRef([]), tornado=useRef(null);
  const cds=useRef({});
  const orbitHit=useRef({});
  const keys=useRef({});
  const mouse=useRef({x:W*0.72,y:H/2});
  const shake=useRef({t:0,mag:0});
  const hitstop=useRef(0);                 // 히트스톱(프레임 단위 시간 정지)
  const combo=useRef({n:0,t:0,bestFx:0});
  const dash=useRef({cd:0,t:0});           // 대시 (Shift/Space)
  const timeS=useRef(0), kills=useRef(0);
  const spawnCd=useRef(0.8), hurtCd=useRef(0), eliteCd=useRef(42);
  const bossState=useRef("none");
  const warnT=useRef(0);
  const running=useRef(true), paused=useRef(false);
  const stars=useRef([]), motes=useRef([]), clouds=useRef([]);
  const vigRef=useRef(null);
  const acc=useRef(0);
  const best=useRef(parseInt(localStorage.getItem("ynd_surv_best")||"0",10));

  const [ui,setUi]=useState({hp:120,maxHp:120,xp:0,need:6,lvl:1,kills:0,time:0,best:best.current,combo:0,dashCd:0});
  const [skillsUi,setSkillsUi]=useState([]);
  const [cards,setCards]=useState(null);
  const [bossWarn,setBossWarn]=useState(false);
  const [enrage,setEnrage]=useState(false);
  const [over,setOver]=useState(null);
  const [win,setWin]=useState(null);
  const [lvlFx,setLvlFx]=useState(0);
  const [tick,setTick]=useState(0);

  function newPlayer(){ return {x:0,y:0,vx:0,vy:0,aim:0,bank:0,hp:120,maxHp:120,xp:0,need:6,lvl:1,dmgMul:1,magnet:110,flap:0}; }
  const syncUi=useCallback(()=>{ const p=P.current; if(!p)return;
    setUi({hp:Math.max(0,Math.ceil(p.hp)),maxHp:p.maxHp,xp:p.xp,need:p.need,lvl:p.lvl,
      kills:kills.current,time:Math.floor(timeS.current),best:best.current,
      combo:combo.current.n,dashCd:Math.max(0,dash.current.cd)}); },[]);
  const syncSkills=useCallback(()=>{
    setSkillsUi(Object.entries(sk.current).map(([id,s])=>({id,lv:s.lv,awake:s.awake}))); },[]);

  /* ---------- 이펙트 ---------- */
  function burst(x,y,color,n,pow){ for(let i=0;i<n;i++){ const a=Math.random()*7,s=rand(.35,1)*(pow||90);
    parts.current.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:0,max:rand(.25,.6),size:rand(2,4.5),color}); } }
  function ringFx(x,y,color,r0,r1,dur){ parts.current.push({ring:true,x,y,r0,r1,life:0,max:dur||.4,color}); }
  function floatTxt(x,y,val,o){ floats.current.push(Object.assign({x:x+rand(-6,6),y,vy:-54,life:0,max:.75,val,big:false,color:"#f1f5f9"},o||{})); }
  function shakeIt(t,m){ if(m>=shake.current.mag||shake.current.t<=0)shake.current={t,mag:m}; }
  function hitStop(f){ hitstop.current=Math.max(hitstop.current,f); }

  /* ---------- 피해 처리 ---------- */
  function hurt(e,dmg,opts){
    const o=opts||{};
    const val=dmg*P.current.dmgMul;
    e.hp-=val; e.flash=1;
    if(o.slow)e.slow=Math.max(e.slow||0,o.slow);
    if(o.knock){ const dx=e.x-(o.fx!=null?o.fx:P.current.x), dy=e.y-(o.fy!=null?o.fy:P.current.y);
      const dl=Math.hypot(dx,dy)||1; const kb=o.knock*(e.kind==="boss"?0.06:e.kind==="elite"?0.3:1);
      e.kx=(e.kx||0)+dx/dl*kb; e.ky=(e.ky||0)+dy/dl*kb; }
    const col=o.big?null:(o.el&&ELE[o.el]?ELE[o.el].g:(o.color||"#f1f5f9"));
    floatTxt(e.x,e.y-e.size-6,Math.round(val),{big:!!o.big,color:col,label:o.big?"AWAKEN!":null,max:o.big?0.95:0.7});
    if(o.big)hitStop(3);
    if(e.hp<=0&&!e.dead){ e.dead=true; kills.current++;
      combo.current.n++; combo.current.t=2.0;
      const cn=combo.current.n;
      if(cn===10||cn===25||cn===50||cn===100){ shakeIt(.3,6+cn/12);
        floatTxt(P.current.x,P.current.y-46,"COMBO x"+cn+"!",{big:true,max:1.1}); }
      deaths.current.push({x:e.x,y:e.y,el:e.el,size:e.size,life:0,max:.32});
      burst(e.x,e.y,ELE[e.el].c,e.kind==="boss"?46:e.kind==="elite"?20:8,e.kind==="boss"?240:105);
      if(e.kind==="boss"){ bossState.current="dead"; shakeIt(.6,14); hitStop(10); ringFx(e.x,e.y,"#fde047",12,160,.7); }
      const gn=e.kind==="boss"?0:(e.kind==="elite"?6:1);
      for(let i=0;i<gn;i++)gems.current.push({x:e.x+rand(-12,12),y:e.y+rand(-12,12),v:e.kind==="elite"?3:1,vx:rand(-30,30),vy:rand(-30,30)});
    }
  }

  /* ---------- 스킬 발동 (마우스 조준) ---------- */
  function castSkills(dt){
    const p=P.current;
    for(const id of Object.keys(sk.current)){
      const s=sk.current[id];
      cds.current[id]=(cds.current[id]||0)-dt;
      if(cds.current[id]>0)continue;
      const lv=s.lv, A=s.awake;
      if(id==="breath"){
        if(A){ cds.current[id]=0.5; shakeIt(.2,5); hitStop(2);
          for(let i=0;i<9;i++){ const a=p.aim+(i-4)*0.16;
            projs.current.push({x:p.x,y:p.y,vx:Math.cos(a)*430,vy:Math.sin(a)*430,life:1.0,size:16,
              dmg:40,pierce:999,el:"fire",kind:"flame"}); }
          burst(p.x+Math.cos(p.aim)*34,p.y+Math.sin(p.aim)*34,"#fca5a5",12,130);
        } else { cds.current[id]=Math.max(0.45,1.1-lv*0.08);
          const n=1+lv; const dmg=8*(1+0.25*(lv-1));
          for(let i=0;i<n;i++){ const a=p.aim+(i-(n-1)/2)*0.11;
            projs.current.push({x:p.x,y:p.y,vx:Math.cos(a)*500,vy:Math.sin(a)*500,life:.8,size:5.5,
              dmg,pierce:lv>=5?1:0,el:"fire",kind:"flame"}); }
          burst(p.x+Math.cos(p.aim)*30,p.y+Math.sin(p.aim)*30,"#fca5a5",3,70); }
      }
      else if(id==="tail"){
        if(A){ cds.current[id]=1.7; shakeIt(.3,7); hitStop(3);
          for(let i=0;i<3;i++) novas.current.push({x:p.x,y:p.y,r0:14,r1:250,life:-i*0.12,max:.55,dmg:34,knock:340,hitSet:{},color:"#d6a878"});
        } else { cds.current[id]=Math.max(1.0,2.3-(lv>=4?0.46:0));
          const r=95*(1+(lv>=2?0.2:0)+(lv>=5?0.25:0));
          novas.current.push({x:p.x,y:p.y,r0:12,r1:r,life:0,max:.32,dmg:12*(1+(lv>=3?0.35:0)+(lv>=5?0.3:0)),knock:200,hitSet:{},color:"#d6a878"}); }
      }
      else if(id==="souls"){
        if(A){ cds.current[id]=2.3; shakeIt(.3,8); hitStop(4);
          for(let i=0;i<24;i++){ const a=i/24*6.283;
            beams.current.push({x1:p.x,y1:p.y,x2:p.x+Math.cos(a)*560,y2:p.y+Math.sin(a)*560,life:.34,dmg:30,el:"void",hitDone:false}); }
        } else { cds.current[id]=1.5;
          const n=(lv>=5?2:0)+1+Math.min(lv,4); const dmg=10*(1+(lv>=3?0.3:0));
          for(let i=0;i<n;i++){ const a=p.aim+rand(-1.1,1.1);
            projs.current.push({x:p.x,y:p.y,vx:Math.cos(a)*260,vy:Math.sin(a)*260,life:2.2,size:6,
              dmg,pierce:0,el:"void",kind:"soul",homing:lv>=4?7:4.5}); } }
      }
      else if(id==="frost"){
        if(A){ cds.current[id]=2.8; shakeIt(.25,6);
          novas.current.push({x:p.x,y:p.y,r0:16,r1:300,life:0,max:.6,dmg:26,slow:2.6,hitSet:{},color:"#93c5fd"});
        } else { cds.current[id]=Math.max(1.0,2.0-(lv>=4?0.4:0));
          const reps=lv>=5?2:1;
          for(let r2=0;r2<reps;r2++){ const a=p.aim+r2*0.22-((reps-1)*0.11);
            projs.current.push({x:p.x,y:p.y,vx:Math.cos(a)*300,vy:Math.sin(a)*300,life:1.0,
              size:13*(1+(lv>=2?0.3:0)),dmg:9*(1+(lv>=3?0.35:0)),pierce:999,el:"water",kind:"wave",slow:lv>=3?1.6:1.1}); } }
      }
      else if(id==="orbit"){
        if(A && cds.current[id]<=0){ cds.current[id]=2.6;
          novas.current.push({x:p.x,y:p.y,r0:20,r1:190,life:0,max:.4,dmg:18,hitSet:{},color:"#fde68a"}); }
        else if(!A) cds.current[id]=999;
      }
      else if(id==="blades"){
        if(A){ cds.current[id]=6.5; shakeIt(.3,6);
          tornado.current={x:p.x+Math.cos(p.aim)*150,y:p.y+Math.sin(p.aim)*150,vx:rand(-50,50),vy:rand(-50,50),life:4.2,r:74,tick:0};
        } else { cds.current[id]=1.5;
          const n=1+(lv>=2?1:0)+(lv>=4?1:0)+(lv>=5?1:0); const dmg=9*(1+(lv>=3?0.3:0)+(lv>=5?0.35:0));
          for(let i=0;i<n;i++){ const a=p.aim+(i-(n-1)/2)*0.42;
            projs.current.push({x:p.x,y:p.y,vx:Math.cos(a)*380,vy:Math.sin(a)*380,life:1.5,size:8,
              dmg,pierce:lv>=3?999:2,el:"wind",kind:"blade",boom:.62,hitSet:{}}); } }
      }
      else if(id==="spikes"){
        if(A){ cds.current[id]=2.4; shakeIt(.2,5);
          const tgts=enemies.current.filter(e=>!e.dead).slice(0,30);
          for(let i=0;i<30;i++){ const t=tgts[i%Math.max(1,tgts.length)];
            const tx=t?t.x+rand(-16,16):p.x+rand(-280,280), ty=t?t.y+rand(-16,16):p.y+rand(-200,200);
            zones.current.push({x:tx,y:ty,t:0,fuse:0.28+i*0.02,r:26,dmg:20,color:"#e5e7eb",spike:true}); }
        } else { cds.current[id]=Math.max(0.9,1.7-(lv>=4?0.26:0));
          const n=6+(lv>=2?2:0)+(lv>=4?2:0)+(lv>=5?4:0); const dmg=7*(1+(lv>=3?0.3:0));
          for(let i=0;i<n;i++){ const a=i/n*6.283;
            projs.current.push({x:p.x,y:p.y,vx:Math.cos(a)*430,vy:Math.sin(a)*430,life:.7,size:4.5,
              dmg,pierce:1,el:"metal",kind:"spike"}); } }
      }
      else if(id==="rune"){
        if(A){ cds.current[id]=3.4;
          const bx=p.x+Math.cos(p.aim)*170, by=p.y+Math.sin(p.aim)*170;
          for(let i=0;i<5;i++) zones.current.push({x:bx+rand(-90,90),y:by+rand(-90,90),t:0,fuse:0.5+i*0.22,r:88,dmg:38,color:"#fcd34d",awk:true});
        } else { cds.current[id]=2.5;
          const n=lv>=4?2:1; const r=60*(1+(lv>=2?0.25:0)+(lv>=5?0.3:0)); const dmg=16*(1+(lv>=3?0.4:0)+(lv>=5?0.3:0));
          for(let i=0;i<n;i++){ const e=pick(enemies.current.filter(x=>!x.dead));
            const zx=e?e.x:p.x+rand(-120,120), zy=e?e.y:p.y+rand(-120,120);
            zones.current.push({x:zx,y:zy,t:0,fuse:0.6,r,dmg,color:"#fcd34d"}); } }
      }
    }
  }
  function stepOrbit(dt,now){
    const s=sk.current.orbit; if(!s)return;
    const p=P.current; const A=s.awake, lv=s.lv;
    const n=A?6:2+(lv>=2?1:0)+(lv>=4?1:0)+(lv>=5?1:0);
    const R=A?86:56*(1+(lv>=4?0.25:0));
    const dmg=A?26:8*(1+(lv>=3?0.35:0)+(lv>=5?0.4:0));
    const spd=A?3.4:1.6*(1+(lv>=3?0.3:0));
    const rot=now/1000*spd;
    for(let i=0;i<n;i++){ const a=rot+i/n*6.283;
      const ox=p.x+Math.cos(a)*R, oy=p.y+Math.sin(a)*R;
      for(const e of enemies.current){ if(e.dead)continue;
        if(d2(ox,oy,e.x,e.y)<Math.pow(e.size+(A?15:9),2)){
          const key=e.id; const last=orbitHit.current[key]||0;
          if(now-last>380){ orbitHit.current[key]=now;
            hurt(e,dmg,{knock:60,big:A,el:"holy"}); burst(ox,oy,"#fde68a",A?8:4,90); } } } }
  }

  /* ---------- 레벨업 카드 ---------- */
  function rollCards(){
    const opts=[];
    for(const id of SKEYS){ const s=sk.current[id];
      if(!s) opts.push({type:"new",id});
      else if(s.lv<5) opts.push({type:"up",id,to:s.lv+1});
      else if(!s.awake) opts.push({type:"awaken",id});
    }
    const picked=[];
    while(picked.length<3&&opts.length){ const i=Math.floor(Math.random()*opts.length); picked.push(opts.splice(i,1)[0]); }
    const fillers=[{type:"heal"},{type:"power"},{type:"magnet"}];
    while(picked.length<3) picked.push(fillers[picked.length%3]);
    return picked;
  }
  function applyCard(c){
    const p=P.current;
    if(c.type==="new"){ sk.current[c.id]={lv:1,awake:false}; cds.current[c.id]=0; }
    else if(c.type==="up"){ sk.current[c.id].lv=c.to; }
    else if(c.type==="awaken"){ sk.current[c.id].awake=true; cds.current[c.id]=0;
      shakeIt(.5,10); hitStop(8); ringFx(p.x,p.y,"#fbbf24",14,180,.6); burst(p.x,p.y,"#fbbf24",30,190);
      floatTxt(p.x,p.y-40,"★ AWAKENING ★",{big:true,max:1.3}); }
    else if(c.type==="heal"){ p.hp=Math.min(p.maxHp,p.hp+40); }
    else if(c.type==="power"){ p.dmgMul*=1.12; }
    else if(c.type==="magnet"){ p.magnet*=1.3; }
    syncSkills();
    setCards(null); paused.current=false;
  }

  /* ---------- 적 스폰 ---------- */
  function spawnEnemy(kind){
    const p=P.current; const a=Math.random()*6.283; const R=Math.max(W,H)*0.62+rand(0,80);
    const t=timeS.current/60;
    const el=pick(EKEYS);
    let e={id:Math.random(),el,kind:kind||"mob",x:p.x+Math.cos(a)*R,y:p.y+Math.sin(a)*R,
      hp:0,maxHp:0,size:12,sp:0,flash:0,slow:0,kx:0,ky:0,shootCd:2,spawnT:0.35,enraged:false,dead:false};
    const base=10*(1+t*1.15);
    if(e.kind==="mob"){ e.hp=base; e.sp=rand(55,86)*(1+t*0.1); e.size=rand(9,13); }
    else if(e.kind==="elite"){ e.hp=base*9; e.sp=rand(42,55); e.size=23; }
    else if(e.kind==="boss"){ e.hp=4200*(1+t*0.5); e.sp=40; e.size=46; }
    e.maxHp=e.hp;
    enemies.current.push(e);
  }

  /* ---------- 메인 스텝 ---------- */
  function step(dt,now){
    const p=P.current; if(!p)return;
    timeS.current+=dt;
    /* 조준: 마우스 → 월드 각도 (화면 중앙이 플레이어) */
    p.aim=Math.atan2(mouse.current.y-H/2, mouse.current.x-W/2);
    /* 이동(관성) + 대시 */
    const ACC=920,FRIC=0.9,MAXV=300;
    let ix=0,iy=0;
    if(keys.current["w"]||keys.current["arrowup"])iy-=1;
    if(keys.current["s"]||keys.current["arrowdown"])iy+=1;
    if(keys.current["a"]||keys.current["arrowleft"])ix-=1;
    if(keys.current["d"]||keys.current["arrowright"])ix+=1;
    if(dash.current.cd>0)dash.current.cd-=dt;
    if(dash.current.t>0)dash.current.t-=dt;
    if((keys.current["shift"]||keys.current[" "])&&dash.current.cd<=0){
      dash.current.cd=2.0; dash.current.t=0.22; hurtCd.current=Math.max(hurtCd.current,0.3);
      const da=(ix||iy)?Math.atan2(iy,ix):p.aim;
      p.vx=Math.cos(da)*760; p.vy=Math.sin(da)*760;
      burst(p.x,p.y,"#c4b5fd",14,150); ringFx(p.x,p.y,"#a78bfa",8,50,.3); }
    if(ix||iy){ const l=Math.hypot(ix,iy); p.vx+=ix/l*ACC*dt; p.vy+=iy/l*ACC*dt; }
    const fr=dash.current.t>0?0.97:FRIC;
    p.vx*=Math.pow(fr,dt*6); p.vy*=Math.pow(fr,dt*6);
    const v=Math.hypot(p.vx,p.vy);
    if(dash.current.t<=0&&v>MAXV){p.vx*=MAXV/v;p.vy*=MAXV/v;}
    p.x+=p.vx*dt; p.y+=p.vy*dt;
    /* 뱅킹(선회 기울기): 조준 대비 횡속도 */
    const lat=(-Math.sin(p.aim))*p.vx+Math.cos(p.aim)*p.vy;
    p.bank+=((lat*0.0011)-p.bank)*Math.min(1,dt*8);
    p.flap+=dt*(5+v/34);
    if(hurtCd.current>0)hurtCd.current-=dt;
    /* 대시 잔상 */
    if(dash.current.t>0&&Math.random()<0.9)
      parts.current.push({x:p.x-p.vx*0.02,y:p.y-p.vy*0.02,vx:-p.vx*0.1,vy:-p.vy*0.1,life:0,max:.3,size:rand(3,6),color:"#c4b5fd"});

    castSkills(dt);
    stepOrbit(dt,now);

    /* 스폰 */
    const t=timeS.current/60;
    spawnCd.current-=dt;
    if(spawnCd.current<=0 && bossState.current!=="dead"){
      spawnCd.current=Math.max(0.10,0.85-t*0.16);
      const n=1+Math.floor(t*1.4);
      for(let i=0;i<Math.min(n,4);i++) if(enemies.current.length<230)spawnEnemy("mob");
    }
    eliteCd.current-=dt;
    if(eliteCd.current<=0 && bossState.current==="none"){ eliteCd.current=42; spawnEnemy("elite"); }
    if(bossState.current==="none" && timeS.current>=BOSS_AT-4){ bossState.current="warn"; warnT.current=4; setBossWarn(true); }
    if(bossState.current==="warn"){ warnT.current-=dt;
      if(warnT.current<=0){ bossState.current="alive"; setBossWarn(false); spawnEnemy("boss"); shakeIt(.5,9); hitStop(6); } }

    /* 적 */
    for(const e of enemies.current){ if(e.dead)continue;
      if(e.spawnT>0)e.spawnT-=dt;
      if(e.flash>0)e.flash-=dt*5;
      if(e.slow>0)e.slow-=dt;
      const dx=p.x-e.x,dy=p.y-e.y,dd=Math.hypot(dx,dy)||1;
      const spMul=(e.slow>0?0.45:1)*(e.spawnT>0?0.3:1);
      e.x+=dx/dd*e.sp*spMul*dt+(e.kx||0)*dt; e.y+=dy/dd*e.sp*spMul*dt+(e.ky||0)*dt;
      e.kx=(e.kx||0)*0.86; e.ky=(e.ky||0)*0.86;
      /* 보스 격노 (HP 50%) */
      if(e.kind==="boss"&&!e.enraged&&e.hp<e.maxHp*0.5){ e.enraged=true; e.sp*=1.55;
        shakeIt(.5,11); hitStop(8); setEnrage(true);
        floatTxt(e.x,e.y-e.size-24,"격노!",{big:true,max:1.2});
        ringFx(e.x,e.y,"#f43f5e",10,140,.6); burst(e.x,e.y,"#f43f5e",30,200); }
      if(e.kind==="boss"){ e.shootCd-=dt;
        if(e.shootCd<=0){ e.shootCd=e.enraged?0.85:1.35;
          const base2=e.enraged?now/600:now/900;
          const nB=e.enraged?16:12, spB=e.enraged?210:170;
          for(let i=0;i<nB;i++){ const a=i/nB*6.283+base2;
            ebullets.current.push({x:e.x,y:e.y,vx:Math.cos(a)*spB,vy:Math.sin(a)*spB,life:3}); } } }
      if(hurtCd.current<=0 && e.spawnT<=0 && d2(e.x,e.y,p.x,p.y)<Math.pow(e.size+16,2)){
        p.hp-=e.kind==="boss"?26:e.kind==="elite"?16:8; hurtCd.current=0.5;
        shakeIt(.25,6); burst(p.x,p.y,"#f87171",10,110); }
    }
    /* 적 탄 */
    for(const b of ebullets.current){ b.life-=dt; b.x+=b.vx*dt; b.y+=b.vy*dt;
      if(hurtCd.current<=0 && d2(b.x,b.y,p.x,p.y)<15*15){ p.hp-=10; hurtCd.current=0.45; b.life=0;
        shakeIt(.2,5); burst(p.x,p.y,"#f87171",8,100); } }
    ebullets.current=ebullets.current.filter(b=>b.life>0);

    /* 투사체 */
    for(const s of projs.current){ s.life-=dt;
      if(s.homing){ let tgt=null,bd=1e12;
        for(const e of enemies.current){ if(e.dead)continue; const dd2=d2(e.x,e.y,s.x,s.y);
          if(dd2<bd&&dd2<380*380){bd=dd2;tgt=e;} }
        if(tgt){ const a=Math.atan2(tgt.y-s.y,tgt.x-s.x),cur=Math.atan2(s.vy,s.vx);
          let da=a-cur; while(da>Math.PI)da-=6.283; while(da<-Math.PI)da+=6.283;
          const na=cur+Math.max(-s.homing*dt,Math.min(s.homing*dt,da));
          const sp=Math.hypot(s.vx,s.vy); s.vx=Math.cos(na)*sp; s.vy=Math.sin(na)*sp; } }
      if(s.boom!=null){ s.boom-=dt;
        if(s.boom<=0){ const dx=p.x-s.x,dy=p.y-s.y,dl=Math.hypot(dx,dy)||1;
          const sp=Math.hypot(s.vx,s.vy); s.vx=dx/dl*sp; s.vy=dy/dl*sp;
          if(dl<24)s.life=0; } }
      s.x+=s.vx*dt; s.y+=s.vy*dt;
      if(s.size>=13&&Math.random()<0.5)
        parts.current.push({x:s.x,y:s.y,vx:rand(-20,20),vy:rand(-20,20),life:0,max:.25,size:rand(2,4),color:ELE[s.el].g});
      for(const e of enemies.current){ if(e.dead)continue;
        if(s.hitSet&&s.hitSet[e.id])continue;
        if(d2(s.x,s.y,e.x,e.y)<Math.pow(e.size+s.size,2)){
          if(s.hitSet)s.hitSet[e.id]=1;
          hurt(e,s.dmg,{slow:s.slow,knock:s.kind==="wave"?90:40,fx:s.x,fy:s.y,big:s.size>=14,el:s.el});
          burst(s.x,s.y,ELE[s.el].g,5,80);
          if(!s.pierce||--s.pierce<0){s.life=0;break;} } }
    }
    projs.current=projs.current.filter(s=>s.life>0);
    /* 레이저 */
    for(const b of beams.current){ if(!b.hitDone){ b.hitDone=true;
        const bx=b.x2-b.x1,by=b.y2-b.y1,bl=Math.hypot(bx,by)||1,ux=bx/bl,uy=by/bl;
        for(const e of enemies.current){ if(e.dead)continue;
          const rx=e.x-b.x1,ry=e.y-b.y1,along=rx*ux+ry*uy;
          if(along>0&&along<bl){ const perp=Math.abs(rx*-uy+ry*ux);
            if(perp<e.size+7)hurt(e,b.dmg,{big:true,el:"void"}); } } }
      b.life-=dt; }
    beams.current=beams.current.filter(b=>b.life>0);
    /* 노바 */
    for(const nv of novas.current){ nv.life+=dt; if(nv.life<0)continue;
      const r=nv.r0+(nv.r1-nv.r0)*Math.min(1,nv.life/nv.max);
      for(const e of enemies.current){ if(e.dead||nv.hitSet[e.id])continue;
        const dd=Math.sqrt(d2(e.x,e.y,nv.x,nv.y));
        if(Math.abs(dd-r)<e.size+16){ nv.hitSet[e.id]=1;
          hurt(e,nv.dmg,{knock:nv.knock||0,slow:nv.slow,fx:nv.x,fy:nv.y,big:nv.r1>200,el:nv.slow?"water":"earth"}); } } }
    novas.current=novas.current.filter(nv=>nv.life<nv.max);
    /* 존 */
    for(const z of zones.current){ z.t+=dt;
      if(z.t>=z.fuse&&!z.boomed){ z.boomed=true;
        burst(z.x,z.y,z.color,z.awk?18:10,z.awk?170:110); ringFx(z.x,z.y,z.color,6,z.r,.35);
        if(z.awk){shakeIt(.22,6);hitStop(2);}
        for(const e of enemies.current){ if(e.dead)continue;
          if(d2(e.x,e.y,z.x,z.y)<z.r*z.r)hurt(e,z.dmg,{knock:120,fx:z.x,fy:z.y,big:!!z.awk,el:z.spike?"metal":"ancient"}); } } }
    zones.current=zones.current.filter(z=>z.t<z.fuse+0.25);
    /* 태풍 */
    if(tornado.current){ const tn=tornado.current; tn.life-=dt; tn.tick-=dt;
      tn.x+=tn.vx*dt; tn.y+=tn.vy*dt;
      for(const e of enemies.current){ if(e.dead)continue;
        const dd=Math.sqrt(d2(e.x,e.y,tn.x,tn.y));
        if(dd<tn.r+120){ const pull=520*dt; e.x+=(tn.x-e.x)/Math.max(1,dd)*pull; e.y+=(tn.y-e.y)/Math.max(1,dd)*pull; } }
      if(tn.tick<=0){ tn.tick=0.3;
        for(const e of enemies.current){ if(e.dead)continue;
          if(d2(e.x,e.y,tn.x,tn.y)<tn.r*tn.r)hurt(e,14,{big:true,el:"wind"}); } }
      if(tn.life<=0)tornado.current=null; }

    enemies.current=enemies.current.filter(e=>!e.dead);

    /* 보석 */
    for(const g of gems.current){
      const dx=p.x-g.x,dy=p.y-g.y,dd=Math.hypot(dx,dy)||1;
      if(dd<p.magnet){ const pull=(1-dd/p.magnet)*1100; g.vx+=dx/dd*pull*dt; g.vy+=dy/dd*pull*dt;
        if(Math.random()<0.3)parts.current.push({x:g.x,y:g.y,vx:rand(-14,14),vy:rand(-14,14),life:0,max:.2,size:1.8,color:"#6ee7b7"}); }
      g.vx*=0.9; g.vy*=0.9; g.x+=g.vx*dt; g.y+=g.vy*dt;
      if(dd<20){ g.dead=true; p.xp+=g.v;
        if(p.xp>=p.need&&!cards){ p.xp-=p.need; p.lvl++; p.need=Math.round(p.need*1.32+3);
          setLvlFx(x=>x+1);
          paused.current=true; setCards(rollCards()); syncUi(); } } }
    gems.current=gems.current.filter(g=>!g.dead);

    /* 콤보 타이머 */
    if(combo.current.t>0){ combo.current.t-=dt; if(combo.current.t<=0)combo.current.n=0; }

    /* 파티클/텍스트/사망팝 */
    for(const pt of parts.current){ pt.life+=dt; if(!pt.ring){ pt.x+=pt.vx*dt; pt.y+=pt.vy*dt; pt.vx*=0.94; pt.vy*=0.94; } }
    parts.current=parts.current.filter(pt=>pt.life<pt.max);
    if(parts.current.length>460)parts.current.splice(0,parts.current.length-460);
    for(const f of floats.current){ f.life+=dt; f.y+=f.vy*dt; f.vy+=64*dt; }
    floats.current=floats.current.filter(f=>f.life<f.max);
    if(floats.current.length>90)floats.current.splice(0,floats.current.length-90);
    for(const dth of deaths.current)dth.life+=dt;
    deaths.current=deaths.current.filter(d=>d.life<d.max);
    if(shake.current.t>0)shake.current.t-=dt;

    /* 승패 */
    if(bossState.current==="dead"&&!win){
      running.current=false;
      const sc=kills.current*10+Math.floor(timeS.current)*3+2000;
      if(sc>best.current){best.current=sc;try{localStorage.setItem("ynd_surv_best",String(sc));}catch(_){}}
      setWin({score:sc,kills:kills.current,time:Math.floor(timeS.current),lvl:p.lvl,best:best.current});
    }
    if(p.hp<=0&&running.current){
      running.current=false;
      const sc=kills.current*10+Math.floor(timeS.current)*3;
      if(sc>best.current){best.current=sc;try{localStorage.setItem("ynd_surv_best",String(sc));}catch(_){}}
      setOver({score:sc,kills:kills.current,time:Math.floor(timeS.current),lvl:p.lvl,best:best.current});
    }
    acc.current+=dt; if(acc.current>=0.12){acc.current=0;syncUi();}
  }

  /* ---------- 렌더 ---------- */
  function draw(now){
    const cv=cvRef.current; if(!cv)return; const ctx=cv.getContext("2d");
    const DPR=cv._dpr||1; ctx.setTransform(DPR,0,0,DPR,0,0);
    const p=P.current;
    let sx=0,sy=0; if(shake.current.t>0){const m=shake.current.mag*(shake.current.t/.3);sx=rand(-m,m);sy=rand(-m,m);}
    const bg=ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,"#0a1226"); bg.addColorStop(1,"#0c0a1e");
    ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
    /* 별(반짝임) */
    for(const st2 of stars.current){
      const rx=((st2.x-p.x*st2.par)%(W+40)+(W+40))%(W+40)-20;
      const ry=((st2.y-p.y*st2.par)%(H+40)+(H+40))%(H+40)-20;
      ctx.globalAlpha=st2.a*(0.55+0.45*Math.sin(now/st2.tw+st2.ph));
      ctx.fillStyle="#e2e8f0"; ctx.fillRect(rx,ry,st2.s,st2.s); }
    ctx.globalAlpha=1;
    /* 그리드 */
    const g1=56,ox1=(-p.x*0.5)%g1,oy1=(-p.y*0.5)%g1;
    ctx.strokeStyle="rgba(99,102,241,.09)"; ctx.lineWidth=1;
    for(let x=ox1-g1;x<W+g1;x+=g1){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=oy1-g1;y<H+g1;y+=g1){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    /* 부유 광점 */
    for(const m of motes.current){
      const rx=((m.x-p.x*m.par)%(W+60)+(W+60))%(W+60)-30;
      const ry=((m.y-p.y*m.par-now*m.dr)%(H+60)+(H+60))%(H+60)-30;
      ctx.globalAlpha=m.a; ctx.fillStyle=m.c;
      ctx.beginPath(); ctx.arc(rx,ry,m.s,0,7); ctx.fill(); }
    ctx.globalAlpha=1;
    /* 구름 */
    for(const c of clouds.current){
      const rx=((c.x-p.x*c.par)%(W+320)+(W+320))%(W+320)-160;
      const ry=((c.y-p.y*c.par)%(H+260)+(H+260))%(H+260)-130;
      const cg=ctx.createRadialGradient(rx,ry,2,rx,ry,c.r);
      cg.addColorStop(0,"rgba(148,163,184,"+c.a+")"); cg.addColorStop(1,"transparent");
      ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(rx,ry,c.r,0,7); ctx.fill(); }
    ctx.save(); ctx.translate(sx,sy);
    const S=(wx,wy)=>({x:wx-p.x+W/2,y:wy-p.y+H/2});
    /* 보석 */
    for(const g of gems.current){ const q=S(g.x,g.y);
      if(q.x<-20||q.x>W+20||q.y<-20||q.y>H+20)continue;
      ctx.save(); ctx.translate(q.x,q.y); ctx.rotate(now/280);
      ctx.shadowColor=g.v>1?"#fde047":"#34d399"; ctx.shadowBlur=9;
      ctx.fillStyle=g.v>1?"#fde047":"#34d399";
      ctx.fillRect(-4,-4,8,8);
      ctx.fillStyle="#fff"; ctx.globalAlpha=.7; ctx.fillRect(-1.5,-1.5,3,3); ctx.globalAlpha=1;
      ctx.restore(); }
    /* 존 */
    for(const z of zones.current){ const q=S(z.x,z.y);
      const f=Math.min(1,z.t/z.fuse);
      ctx.globalAlpha=.65; ctx.strokeStyle=z.color; ctx.lineWidth=2;
      if(z.spike){ ctx.beginPath(); ctx.moveTo(q.x,q.y-14+f*10); ctx.lineTo(q.x-5,q.y+2); ctx.lineTo(q.x+5,q.y+2); ctx.closePath();
        ctx.fillStyle=z.color; ctx.fill(); }
      else { ctx.save(); ctx.translate(q.x,q.y); ctx.rotate(now/600);
        ctx.beginPath(); ctx.arc(0,0,z.r*(0.35+f*0.65),0,7); ctx.stroke();
        ctx.setLineDash([6,8]); ctx.beginPath(); ctx.arc(0,0,z.r*(0.2+f*0.5),0,7); ctx.stroke(); ctx.setLineDash([]);
        ctx.globalAlpha=.18; ctx.fillStyle=z.color; ctx.fill(); ctx.restore(); }
      ctx.globalAlpha=1; }
    /* 태풍 */
    if(tornado.current){ const tn=tornado.current; const q=S(tn.x,tn.y);
      for(let i=0;i<4;i++){ ctx.save(); ctx.translate(q.x,q.y); ctx.rotate(now/200+i*1.55);
        ctx.strokeStyle="rgba(186,230,253,"+(0.5-i*0.09)+")"; ctx.lineWidth=4-i*0.6;
        ctx.beginPath(); ctx.arc(0,0,tn.r*(0.35+i*0.22),0.4,5.6); ctx.stroke(); ctx.restore(); } }
    /* 적 탄 */
    for(const b of ebullets.current){ const q=S(b.x,b.y);
      ctx.shadowColor="#f87171"; ctx.shadowBlur=9; ctx.fillStyle="#fca5a5";
      ctx.beginPath(); ctx.arc(q.x,q.y,5,0,7); ctx.fill();
      ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(q.x,q.y,2,0,7); ctx.fill(); ctx.shadowBlur=0; }
    /* 사망 팝 */
    for(const dth of deaths.current){ const q=S(dth.x,dth.y); const f=dth.life/dth.max;
      ctx.globalAlpha=(1-f)*.85; ctx.strokeStyle=ELE[dth.el].g; ctx.lineWidth=3*(1-f)+1;
      ctx.beginPath(); ctx.arc(q.x,q.y,dth.size*(1+f*1.8),0,7); ctx.stroke(); ctx.globalAlpha=1; }
    /* 적 */
    for(const e of enemies.current){ const q=S(e.x,e.y);
      if(q.x<-80||q.x>W+80||q.y<-80||q.y>H+80)continue;
      drawEnemy(ctx,q.x,q.y,e,now); }
    /* 노바 */
    for(const nv of novas.current){ if(nv.life<0)continue; const q=S(nv.x,nv.y);
      const r=nv.r0+(nv.r1-nv.r0)*Math.min(1,nv.life/nv.max);
      ctx.globalAlpha=(1-nv.life/nv.max)*.85; ctx.strokeStyle=nv.color; ctx.lineWidth=6;
      ctx.beginPath(); ctx.arc(q.x,q.y,r,0,7); ctx.stroke();
      ctx.lineWidth=2; ctx.strokeStyle="#fff"; ctx.globalAlpha*=.6;
      ctx.beginPath(); ctx.arc(q.x,q.y,r-5,0,7); ctx.stroke(); ctx.globalAlpha=1; }
    /* 레이저 */
    for(const b of beams.current){ const q1=S(b.x1,b.y1),q2=S(b.x2,b.y2);
      ctx.globalAlpha=b.life/.34;
      ctx.strokeStyle="#d8b4fe"; ctx.lineWidth=5; ctx.shadowColor="#a855f7"; ctx.shadowBlur=14;
      ctx.beginPath(); ctx.moveTo(q1.x,q1.y); ctx.lineTo(q2.x,q2.y); ctx.stroke();
      ctx.strokeStyle="#fff"; ctx.lineWidth=1.6; ctx.stroke();
      ctx.shadowBlur=0; ctx.globalAlpha=1; }
    /* 투사체 */
    for(const s of projs.current){ const q=S(s.x,s.y); const c=ELE[s.el];
      ctx.shadowColor=c.c; ctx.shadowBlur=s.size>=13?18:9;
      if(s.kind==="blade"){ ctx.save(); ctx.translate(q.x,q.y); ctx.rotate(now/60);
        ctx.fillStyle=c.g; ctx.beginPath();
        for(let i=0;i<3;i++){ const a=i/3*6.283; ctx.moveTo(0,0); ctx.quadraticCurveTo(Math.cos(a+0.5)*s.size*1.6,Math.sin(a+0.5)*s.size*1.6,Math.cos(a)*s.size*2,Math.sin(a)*s.size*2); }
        ctx.fill(); ctx.restore(); }
      else if(s.kind==="wave"){ ctx.strokeStyle=c.g; ctx.lineWidth=4;
        ctx.beginPath(); ctx.arc(q.x,q.y,s.size,Math.atan2(s.vy,s.vx)-1.1,Math.atan2(s.vy,s.vx)+1.1); ctx.stroke(); }
      else { ctx.fillStyle=c.g; ctx.beginPath(); ctx.arc(q.x,q.y,s.size,0,7); ctx.fill();
        ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(q.x,q.y,Math.max(1.2,s.size*0.38),0,7); ctx.fill(); }
      ctx.shadowBlur=0; }
    /* 궤도체 */
    const so=sk.current.orbit;
    if(so){ const A=so.awake,lv=so.lv;
      const n=A?6:2+(lv>=2?1:0)+(lv>=4?1:0)+(lv>=5?1:0);
      const R=A?86:56*(1+(lv>=4?0.25:0));
      const rot=now/1000*(A?3.4:1.6*(1+(lv>=3?0.3:0)));
      for(let i=0;i<n;i++){ const a=rot+i/n*6.283;
        const q=S(p.x+Math.cos(a)*R,p.y+Math.sin(a)*R);
        ctx.shadowColor="#eab308"; ctx.shadowBlur=12; ctx.fillStyle="#fde68a";
        if(A){ ctx.save(); ctx.translate(q.x,q.y); ctx.rotate(a+now/150);
          ctx.beginPath(); ctx.moveTo(0,-14); ctx.lineTo(5,8); ctx.lineTo(-5,8); ctx.closePath(); ctx.fill(); ctx.restore(); }
        else { ctx.beginPath(); ctx.arc(q.x,q.y,7,0,7); ctx.fill(); }
        ctx.shadowBlur=0; } }
    /* 파티클 */
    for(const pt of parts.current){ const q=S(pt.x,pt.y); const a=1-pt.life/pt.max;
      if(pt.ring){ ctx.globalAlpha=a*.9; ctx.strokeStyle=pt.color; ctx.lineWidth=3;
        ctx.beginPath(); ctx.arc(q.x,q.y,pt.r0+(pt.r1-pt.r0)*(pt.life/pt.max),0,7); ctx.stroke(); }
      else { ctx.globalAlpha=a; ctx.fillStyle=pt.color; ctx.beginPath(); ctx.arc(q.x,q.y,pt.size*a+0.5,0,7); ctx.fill(); } }
    ctx.globalAlpha=1;
    /* 드래곤 */
    drawDragon(ctx,W/2,H/2,p,now);
    /* 텍스트 */
    for(const f of floats.current){ const q=S(f.x,f.y); const a=1-f.life/f.max;
      ctx.globalAlpha=Math.max(0,a);
      const popS=f.big?(1+0.7*Math.max(0,1-f.life*6)):1;
      if(f.big){ const gr=ctx.createLinearGradient(q.x,q.y-16,q.x,q.y);
        gr.addColorStop(0,"#fecaca"); gr.addColorStop(1,"#ef4444");
        ctx.font="bold "+Math.round(21*popS)+"px ui-monospace,monospace"; ctx.fillStyle=gr; }
      else { ctx.font="bold 13px ui-monospace,monospace"; ctx.fillStyle=f.color; }
      ctx.textAlign="center"; ctx.lineWidth=3; ctx.strokeStyle="rgba(0,0,0,.65)";
      ctx.strokeText(f.val,q.x,q.y); ctx.fillText(f.val,q.x,q.y);
      if(f.label){ ctx.font="bold 10px sans-serif"; ctx.fillStyle="#fbbf24"; ctx.fillText(f.label,q.x,q.y-17); } }
    ctx.globalAlpha=1;
    /* 보스 HP */
    const boss=enemies.current.find(e=>e.kind==="boss"&&!e.dead);
    if(boss){ const w2=W-180,x=90,y=16,r=Math.max(0,boss.hp/boss.maxHp);
      ctx.fillStyle="rgba(0,0,0,.6)"; ctx.fillRect(x,y,w2,13);
      const bg2=ctx.createLinearGradient(x,0,x+w2,0);
      if(boss.enraged){ bg2.addColorStop(0,"#f43f5e"); bg2.addColorStop(1,"#ef4444"); }
      else { bg2.addColorStop(0,"#f43f5e"); bg2.addColorStop(1,"#a855f7"); }
      ctx.fillStyle=bg2; ctx.fillRect(x,y,w2*r,13);
      ctx.strokeStyle="rgba(255,255,255,.4)"; ctx.strokeRect(x,y,w2,13);
      ctx.font="bold 11px sans-serif"; ctx.textAlign="center"; ctx.fillStyle="#fff";
      ctx.fillText((boss.enraged?"💢 ":"👑 ")+"파멸의 고룡  "+Math.ceil(boss.hp)+" / "+Math.ceil(boss.maxHp),W/2,y+11); }
    ctx.restore();
    /* 비네트 */
    if(vigRef.current)ctx.drawImage(vigRef.current,0,0);
    /* 저체력 경고 */
    if(p.hp<p.maxHp*0.3&&running.current){
      ctx.globalAlpha=0.16+0.13*Math.sin(now/180);
      const vg=ctx.createRadialGradient(W/2,H/2,H*0.32,W/2,H/2,H*0.72);
      vg.addColorStop(0,"transparent"); vg.addColorStop(1,"#dc2626");
      ctx.fillStyle=vg; ctx.fillRect(0,0,W,H); ctx.globalAlpha=1; }
    if(hurtCd.current>0.3){ ctx.fillStyle="rgba(239,68,68,"+(hurtCd.current-0.3)*0.85+")"; ctx.fillRect(0,0,W,H); }
    /* 크로스헤어 */
    const mx=mouse.current.x,my=mouse.current.y;
    ctx.save(); ctx.translate(mx,my); ctx.rotate(now/700);
    ctx.strokeStyle="#fbbf24"; ctx.lineWidth=1.8; ctx.shadowColor="#fbbf24"; ctx.shadowBlur=6;
    ctx.beginPath(); ctx.arc(0,0,10,0,7); ctx.stroke();
    for(let i=0;i<4;i++){ const a=i*Math.PI/2;
      ctx.beginPath(); ctx.moveTo(Math.cos(a)*13,Math.sin(a)*13); ctx.lineTo(Math.cos(a)*19,Math.sin(a)*19); ctx.stroke(); }
    ctx.shadowBlur=0; ctx.fillStyle="#fff";
    ctx.beginPath(); ctx.arc(0,0,1.6,0,7); ctx.fill(); ctx.restore();
  }
  function drawDragon(ctx,x,y,p,now){
    const flap=Math.sin(p.flap);
    const breathe=1+Math.sin(now/300)*0.03;
    /* 그림자 */
    ctx.save(); ctx.translate(x,y+26);
    ctx.globalAlpha=.3; ctx.fillStyle="#000";
    ctx.beginPath(); ctx.ellipse(0,0,26*breathe,8*breathe,0,0,7); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(x,y); ctx.rotate(p.aim); ctx.rotate(p.bank*0.5); ctx.scale(breathe,breathe);
    const wingExt=0.7+flap*0.35;
    /* 날개 (막+골격) */
    ctx.fillStyle="#7c3aedcc"; ctx.strokeStyle="#c4b5fd"; ctx.lineWidth=1.6;
    for(const sgn of [-1,1]){ ctx.save(); ctx.rotate(sgn*(0.35+wingExt*0.35));
      ctx.beginPath(); ctx.moveTo(-6,sgn*-2);
      ctx.quadraticCurveTo(-26,sgn*-38*wingExt,-58,sgn*-46*wingExt);
      ctx.quadraticCurveTo(-46,sgn*-24*wingExt,-40,sgn*-12*wingExt);
      ctx.quadraticCurveTo(-30,sgn*-16*wingExt,-24,sgn*-6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle="#a78bfa88"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(-8,sgn*-3); ctx.lineTo(-52,sgn*-40*wingExt);
      ctx.moveTo(-10,sgn*-3); ctx.lineTo(-44,sgn*-22*wingExt); ctx.stroke();
      ctx.restore(); ctx.strokeStyle="#c4b5fd"; ctx.lineWidth=1.6; }
    /* 꼬리 */
    ctx.strokeStyle="#6d28d9"; ctx.lineWidth=6; ctx.lineCap="round";
    const ty=Math.sin(now/170)*12;
    ctx.beginPath(); ctx.moveTo(-16,0);
    ctx.quadraticCurveTo(-32,ty*0.6,-46,ty); ctx.stroke();
    ctx.fillStyle="#c4b5fd"; ctx.beginPath();
    ctx.moveTo(-46,ty-6); ctx.lineTo(-58,ty); ctx.lineTo(-46,ty+6); ctx.closePath(); ctx.fill();
    /* 몸통 */
    ctx.shadowColor="#8b5cf6"; ctx.shadowBlur=20;
    const bgr=ctx.createLinearGradient(-20,0,26,0);
    bgr.addColorStop(0,"#6d28d9"); bgr.addColorStop(1,"#a78bfa");
    ctx.fillStyle=bgr;
    ctx.beginPath(); ctx.ellipse(0,0,22,13,0,0,7); ctx.fill(); ctx.shadowBlur=0;
    ctx.strokeStyle="#ddd6fe88"; ctx.lineWidth=1.4;
    for(let i=-2;i<=2;i++){ ctx.beginPath(); ctx.arc(i*7,4,6,0.4,2.7); ctx.stroke(); }
    /* 등 가시 */
    ctx.fillStyle="#4c1d95";
    for(let i=-1;i<=2;i++){ ctx.beginPath(); ctx.moveTo(i*8-3,-10); ctx.lineTo(i*8,-16); ctx.lineTo(i*8+3,-10); ctx.closePath(); ctx.fill(); }
    /* 머리 */
    ctx.fillStyle="#a78bfa";
    ctx.beginPath(); ctx.moveTo(16,-8); ctx.quadraticCurveTo(40,0,16,8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle="#6d28d9"; ctx.lineWidth=2.4;
    ctx.beginPath(); ctx.moveTo(15,-7); ctx.lineTo(8,-15); ctx.moveTo(15,7); ctx.lineTo(8,15); ctx.stroke();
    ctx.fillStyle="#0b1020"; ctx.beginPath(); ctx.arc(19,-3,2,0,7); ctx.arc(19,3,2,0,7); ctx.fill();
    ctx.restore();
    if(hurtCd.current>0&&Math.floor(now/70)%2===0){
      ctx.globalAlpha=.3; ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(x,y,30,0,7); ctx.fill(); ctx.globalAlpha=1; }
  }
  function drawEnemy(ctx,x,y,e,now){
    const c=ELE[e.el];
    ctx.save(); ctx.translate(x,y);
    if(e.spawnT>0){ const f=1-e.spawnT/0.35; ctx.scale(f,f); ctx.globalAlpha=f; }
    const grd=ctx.createRadialGradient(-e.size*.3,-e.size*.3,1,0,0,e.size);
    grd.addColorStop(0,c.g); grd.addColorStop(1,c.c);
    ctx.shadowColor=e.kind==="boss"&&e.enraged?"#f43f5e":c.c;
    ctx.shadowBlur=e.kind==="boss"?26:e.kind==="elite"?12:6;
    ctx.fillStyle=grd;
    ctx.beginPath(); ctx.arc(0,0,e.size,0,7); ctx.fill(); ctx.shadowBlur=0;
    if(e.kind==="elite"){ ctx.strokeStyle="#e2e8f0"; ctx.lineWidth=2.5; ctx.beginPath(); ctx.arc(0,0,e.size+4,0,7); ctx.stroke(); }
    if(e.kind==="boss"){ ctx.save(); ctx.rotate(-now/500);
      ctx.strokeStyle=(e.enraged?"#f43f5e":c.g)+"aa"; ctx.lineWidth=4; ctx.setLineDash([10,12]);
      ctx.beginPath(); ctx.arc(0,0,e.size+12,0,7); ctx.stroke(); ctx.restore();
      ctx.font="18px sans-serif"; ctx.textAlign="center"; ctx.fillText(e.enraged?"💢":"👑",0,-e.size-14); }
    ctx.fillStyle="#0b1020"; ctx.beginPath();
    ctx.arc(-e.size*.3,-e.size*.14,e.size*.16,0,7); ctx.arc(e.size*.3,-e.size*.14,e.size*.16,0,7); ctx.fill();
    if(e.slow>0){ ctx.globalAlpha=.4; ctx.fillStyle="#60a5fa"; ctx.beginPath(); ctx.arc(0,0,e.size,0,7); ctx.fill(); ctx.globalAlpha=1; }
    if(e.flash>0){ ctx.globalAlpha=Math.min(1,e.flash)*.85; ctx.fillStyle="#fff";
      ctx.beginPath(); ctx.arc(0,0,e.size,0,7); ctx.fill(); ctx.globalAlpha=1; }
    if(e.kind!=="mob"){ const w2=e.size*2,r=Math.max(0,e.hp/e.maxHp);
      ctx.fillStyle="rgba(0,0,0,.55)"; ctx.fillRect(-w2/2,-e.size-9,w2,4);
      ctx.fillStyle=r>.5?"#22c55e":r>.25?"#eab308":"#ef4444"; ctx.fillRect(-w2/2,-e.size-9,w2*r,4); }
    ctx.restore();
  }

  /* ---------- 루프/입력 ---------- */
  useEffect(()=>{
    const cv=cvRef.current; const DPR=Math.min(2,window.devicePixelRatio||1);
    cv.width=W*DPR; cv.height=H*DPR; cv.style.width=W+"px"; cv.style.height=H+"px"; cv._dpr=DPR;
    P.current=newPlayer();
    sk.current={breath:{lv:1,awake:false}}; syncSkills();
    clouds.current=Array.from({length:10},()=>({x:rand(0,W+320),y:rand(0,H+260),r:rand(40,110),a:rand(.05,.12),par:rand(.7,.95)}));
    stars.current=Array.from({length:60},()=>({x:rand(0,W+40),y:rand(0,H+40),s:rand(1,2.2),a:rand(.1,.4),par:rand(.1,.3),tw:rand(300,900),ph:rand(0,7)}));
    motes.current=Array.from({length:16},()=>({x:rand(0,W+60),y:rand(0,H+60),s:rand(1.5,3.5),a:rand(.15,.4),par:rand(.4,.6),dr:rand(.005,.02),c:pick(["#a78bfa66","#67e8f966","#fde04744"])}));
    /* 비네트 캐시 */
    const vg=document.createElement("canvas"); vg.width=W; vg.height=H;
    const vctx=vg.getContext("2d");
    const rg=vctx.createRadialGradient(W/2,H/2,H*0.42,W/2,H/2,H*0.85);
    rg.addColorStop(0,"transparent"); rg.addColorStop(1,"rgba(2,4,12,.55)");
    vctx.fillStyle=rg; vctx.fillRect(0,0,W,H);
    vigRef.current=vg;
    let raf,last=performance.now(),accum=0; const STEP=1/60;
    const loop=(now)=>{ let dt=(now-last)/1000; last=now; if(dt>0.5)dt=0.5; accum+=dt;
      let guard=0;
      while(accum>=STEP&&guard++<40){
        if(hitstop.current>0){ hitstop.current--; accum-=STEP; continue; }
        if(running.current&&!paused.current)step(STEP,now); accum-=STEP; }
      if(accum>=STEP)accum=0;
      draw(now); raf=requestAnimationFrame(loop); };
    raf=requestAnimationFrame(loop);
    const kd=e=>{ const k=e.key.toLowerCase(); keys.current[k]=true;
      if([" ","arrowup","arrowdown","arrowleft","arrowright"].includes(k))e.preventDefault(); };
    const ku=e=>{ keys.current[e.key.toLowerCase()]=false; };
    const mm=e=>{ const r=cv.getBoundingClientRect();
      mouse.current.x=(e.clientX-r.left)*(W/r.width); mouse.current.y=(e.clientY-r.top)*(H/r.height); };
    window.addEventListener("keydown",kd); window.addEventListener("keyup",ku);
    cv.addEventListener("mousemove",mm);
    return ()=>{ cancelAnimationFrame(raf);
      window.removeEventListener("keydown",kd); window.removeEventListener("keyup",ku);
      cv.removeEventListener("mousemove",mm); };
  },[]);

  function restart(){
    P.current=newPlayer();
    sk.current={breath:{lv:1,awake:false}}; cds.current={}; orbitHit.current={};
    enemies.current=[]; projs.current=[]; beams.current=[]; novas.current=[]; zones.current=[];
    ebullets.current=[]; gems.current=[]; parts.current=[]; floats.current=[]; deaths.current=[]; tornado.current=null;
    timeS.current=0; kills.current=0; spawnCd.current=0.8; hurtCd.current=0; eliteCd.current=42;
    combo.current={n:0,t:0}; dash.current={cd:0,t:0}; hitstop.current=0;
    bossState.current="none"; warnT.current=0; shake.current={t:0,mag:0};
    running.current=true; paused.current=false;
    setOver(null); setWin(null); setCards(null); setBossWarn(false); setEnrage(false); syncSkills(); syncUi();
  }

  const xpPct=Math.max(0,Math.min(100,ui.xp/ui.need*100));
  const hpPct=Math.max(0,ui.hp/ui.maxHp*100);
  const bossIn=Math.max(0,BOSS_AT-ui.time);

  function cardInfo(c){
    if(c.type==="heal")return{icon:"❤️",name:"생명의 숨결",stars:0,awk:false,txt:"HP를 40 회복한다."};
    if(c.type==="power")return{icon:"⚔️",name:"용의 분노",stars:0,awk:false,txt:"모든 피해 +12% (영구)"};
    if(c.type==="magnet")return{icon:"🧲",name:"용의 인력",stars:0,awk:false,txt:"보석 흡수 범위 +30%"};
    const d=SKILLS[c.id];
    if(c.type==="new")return{icon:d.icon,name:d.name,stars:1,awk:false,txt:"[신규 습득] "+d.lvTxt[0],el:d.el};
    if(c.type==="up")return{icon:d.icon,name:d.name,stars:c.to,awk:false,txt:d.lvTxt[c.to-1],el:d.el};
    return{icon:d.icon,name:d.awkName,stars:5,awk:true,txt:"[각성] "+d.awkTxt,el:d.el};
  }

  return (
    <div className="min-h-screen w-full text-slate-100 p-3 flex flex-col items-center"
      style={{background:"radial-gradient(1100px 500px at 50% -8%, #1e1b4b55, transparent), #05070f"}}>
      <div className="glass rounded-2xl px-4 py-2 mb-2 shadow-xl" style={{width:W}}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="font-black text-lg bg-gradient-to-r from-violet-300 to-rose-400 bg-clip-text text-transparent">🐲 드래곤 서바이버</div>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-500/25 text-violet-300">Lv.{ui.lvl}</span>
          {ui.combo>=5&&<span key={ui.combo} className="combopop text-xs font-black px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-300">🔥 COMBO x{ui.combo}</span>}
          <div className="flex-1"></div>
          <span className="text-sm font-bold text-slate-300">💀 {ui.kills}</span>
          <span className="text-sm font-bold text-sky-300">⏱ {Math.floor(ui.time/60)}:{String(ui.time%60).padStart(2,"0")}</span>
          <span className="text-sm font-bold text-rose-300">{bossIn>0?("👑 "+Math.floor(bossIn/60)+":"+String(bossIn%60).padStart(2,"0")):"👑 최종 결전!"}</span>
          <span className="text-sm font-bold text-yellow-300">🏆 {ui.best.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs font-bold text-emerald-300 w-20">EXP {ui.xp}/{ui.need}</span>
          <div className="flex-1 h-3.5 rounded-full bg-slate-800/80 overflow-hidden border border-white/10">
            <div className="h-full rounded-full transition-all duration-150"
              style={{width:xpPct+"%",background:"linear-gradient(90deg,#34d399,#a3e635,#fde047)"}}></div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs font-bold text-red-300 w-20">❤️ {ui.hp}/{ui.maxHp}</span>
          <div className="flex-1 h-2.5 rounded-full bg-slate-800/80 overflow-hidden border border-white/10">
            <div className="h-full rounded-full transition-all duration-150"
              style={{width:hpPct+"%",background:"linear-gradient(90deg,#ef4444,#f97316)"}}></div>
          </div>
          <span className={"text-[10px] font-bold px-2 py-0.5 rounded-full "+(ui.dashCd<=0?"bg-violet-500/30 text-violet-200":"bg-slate-800 text-slate-500")}>
            ⚡ 대시 {ui.dashCd<=0?"READY":ui.dashCd.toFixed(1)+"s"}</span>
        </div>
      </div>

      <div className="relative">
        <canvas ref={cvRef} className="shadow-2xl" style={{border:"1px solid rgba(255,255,255,.08)"}}/>
        {bossWarn&&(
          <div className="absolute top-8 left-1/2 -translate-x-1/2 bosswarn glass rounded-xl px-7 py-2.5 border-2 border-red-500/70">
            <span className="font-black text-red-400 text-xl tracking-widest">⚠️ 파멸의 고룡 강림 ⚠️</span>
          </div>)}
        {enrage&&!win&&!over&&(
          <div className="absolute top-8 left-1/2 -translate-x-1/2 bosswarn glass rounded-xl px-5 py-1.5 border-2 border-rose-500/80">
            <span className="font-black text-rose-400 text-base tracking-widest">💢 보스 격노!</span>
          </div>)}
        <div key={lvlFx} className={lvlFx?"absolute inset-0 pointer-events-none rounded-2xl lvlflash":""}
          style={lvlFx?{background:"radial-gradient(circle,rgba(253,224,71,.25),transparent 60%)"}:{}}></div>

        {cards&&(
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-2xl z-20">
            <div className="text-2xl font-black mb-1 bg-gradient-to-r from-amber-300 to-rose-400 bg-clip-text text-transparent pop">⬆ LEVEL UP!</div>
            <div className="text-xs text-slate-300 mb-4">스킬을 선택하세요 — 선택 즉시 전투 재개</div>
            <div className="flex gap-3 px-4">
              {cards.map((c,i)=>{ const info=cardInfo(c);
                return (
                  <button key={i} onClick={()=>applyCard(c)}
                    className={"btng cardin glass rounded-2xl p-4 w-44 text-left "+(info.awk?"awkglow":"")}
                    style={{animationDelay:(i*0.08)+"s",
                      borderColor:info.awk?"#fbbf24":info.el?ELE[info.el].c+"77":"rgba(255,255,255,.15)",
                      borderWidth:2}}>
                    <div className="text-4xl mb-2 text-center">{info.icon}</div>
                    <div className={"font-black text-center mb-1 "+(info.awk?"text-amber-300":"text-slate-100")}>{info.name}</div>
                    <div className="text-center mb-2 text-sm tracking-widest">
                      {info.awk
                        ? <span className="text-amber-300 font-black">★★★★★ +각성</span>
                        : info.stars>0
                          ? <span><span className="text-yellow-300">{"★".repeat(info.stars)}</span><span className="text-slate-600">{"★".repeat(5-info.stars)}</span></span>
                          : <span className="text-slate-500">보조 강화</span>}
                    </div>
                    <div className="text-[11px] text-slate-300 leading-snug">{info.txt}</div>
                  </button>); })}
            </div>
          </div>)}
      </div>

      <div className="glass rounded-2xl px-3 py-2 mt-2 shadow-xl" style={{width:W}}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-slate-400">보유 스킬</span>
          {skillsUi.map(s=>{ const d=SKILLS[s.id];
            return (
              <div key={s.id} className={"flex items-center gap-1 rounded-lg px-2 py-1 border "+(s.awake?"awkglow border-amber-400/70 bg-amber-500/10":"border-white/10 bg-slate-800/50")}>
                <span className="text-base">{d.icon}</span>
                <span className={"text-[10px] font-bold "+(s.awake?"text-amber-300":"text-slate-200")}>
                  {s.awake?d.awkName:d.name}</span>
                <span className="text-[10px] tracking-tight">
                  {s.awake?<span className="text-amber-300 font-black">각성</span>
                    :<span><span className="text-yellow-300">{"★".repeat(s.lv)}</span><span className="text-slate-600">{"★".repeat(5-s.lv)}</span></span>}
                </span>
              </div>); })}
          <div className="flex-1"></div>
          <span className="text-[10px] text-slate-400">🎮 <b className="text-slate-200">WASD</b> 비행 · <b className="text-slate-200">마우스</b> 조준 · <b className="text-slate-200">Shift/Space</b> 대시 — 스킬은 자동! <b className="text-amber-300">★5→각성</b></span>
        </div>
      </div>

      {over&&(
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="glass rounded-2xl p-8 text-center pop max-w-sm w-full">
            <div className="text-6xl mb-2">🐲💤</div>
            <div className="text-2xl font-black text-red-400 mb-4">드래곤 쓰러지다...</div>
            <ResultGrid r={over}/>
            <button onClick={restart} className="btng w-full py-3 rounded-xl font-black text-slate-900 bg-gradient-to-r from-violet-400 to-rose-400 shadow-lg">🔄 다시 도전</button>
          </div>
        </div>)}
      {win&&(
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="glass rounded-2xl p-8 text-center pop max-w-sm w-full" style={{borderColor:"#fde04788"}}>
            <div className="text-6xl mb-2">👑🐲</div>
            <div className="text-2xl font-black text-amber-300 mb-1">파멸의 고룡 토벌!</div>
            <div className="text-slate-300 text-sm mb-4">전설이 되었다 — 완벽한 승리!</div>
            <ResultGrid r={win}/>
            <button onClick={restart} className="btng w-full py-3 rounded-xl font-black text-slate-900 bg-gradient-to-r from-amber-300 to-yellow-400 shadow-lg">🔄 새로운 전설</button>
          </div>
        </div>)}
    </div>
  );
}
function ResultGrid({r}){
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
        <div className="rounded-xl bg-slate-800/70 p-2"><div className="text-slate-400 text-xs">점수</div><div className="text-2xl font-black text-amber-300">{r.score.toLocaleString()}</div></div>
        <div className="rounded-xl bg-slate-800/70 p-2"><div className="text-slate-400 text-xs">처치</div><div className="text-2xl font-black text-slate-200">{r.kills}</div></div>
        <div className="rounded-xl bg-slate-800/70 p-2"><div className="text-slate-400 text-xs">생존</div><div className="text-xl font-black text-sky-300">{Math.floor(r.time/60)}:{String(r.time%60).padStart(2,"0")}</div></div>
        <div className="rounded-xl bg-slate-800/70 p-2"><div className="text-slate-400 text-xs">레벨</div><div className="text-xl font-black text-emerald-300">Lv.{r.lvl}</div></div>
      </div>
      <div className="text-xs text-slate-400 mb-4">🏆 최고 점수: <b className="text-yellow-300">{r.best.toLocaleString()}</b>{r.score>=r.best&&r.score>0?" — 신기록!":""}</div>
    </div>);
}

ReactDOM.createRoot(document.getElementById("root")).render(<Game/>);
</script>
</body>
</html>'''


def dragon_rider_page():
    st.title("🐲 드래곤 서바이버: 9속성 로그라이트")
    st.caption("탕탕특공대 스타일! WASD 비행 + 마우스 조준 + Shift 대시 — 레벨업마다 스킬 카드를 골라 ★5성을 넘어 '각성'의 쾌감까지. 4분 뒤 최종 보스!")
    components.html(DRAGON_RIDER_HTML, height=840, scrolling=True)


# ==========================================
# 7-4. 다마고치: 몽글이 키우기 (React 임베드)
# ==========================================
MONGGLE_HTML = r'''<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<script src="https://cdn.tailwindcss.com"></script>
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script>
  Babel.registerPreset('classic-react', { presets: [[Babel.availablePresets['react'], { runtime: 'classic' }]] });
</script>
<style>
  html,body{margin:0;padding:0;background:#fdf2f8;overflow-x:hidden;font-family:'Segoe UI',ui-rounded,system-ui,sans-serif;}
  #root{min-height:100vh;}
  .soft{box-shadow:0 10px 40px rgba(190,150,200,.28), inset 0 1px 0 rgba(255,255,255,.6);}
  .btnpop{transition:transform .12s, box-shadow .12s, filter .12s;}
  .btnpop:hover{transform:translateY(-3px);filter:brightness(1.04);}
  .btnpop:active{transform:translateY(1px) scale(.97);}
  .float{position:absolute;pointer-events:none;font-size:26px;animation:floatUp 1.3s ease-out forwards;z-index:30;}
  @keyframes floatUp{0%{opacity:0;transform:translateY(0) scale(.6)}20%{opacity:1;transform:translateY(-14px) scale(1.1)}100%{opacity:0;transform:translateY(-72px) scale(1)}}
  .idle{animation:idle 3.2s ease-in-out infinite;}
  @keyframes idle{0%,100%{transform:translateY(0) scale(1,1)}50%{transform:translateY(-6px) scale(1.02,.98)}}
  .bounce{animation:bounce .5s cubic-bezier(.3,1.5,.5,1) infinite;}
  @keyframes bounce{0%,100%{transform:translateY(0) scale(1,1)}30%{transform:translateY(-30px) scale(.92,1.1)}60%{transform:translateY(0) scale(1.12,.88)}}
  .munch{animation:munch .4s ease-in-out;}
  @keyframes munch{0%,100%{transform:scale(1,1)}50%{transform:scale(1.12,.9)}}
  .sleepbob{animation:sleepbob 3.4s ease-in-out infinite;}
  @keyframes sleepbob{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(3px) scale(1.02,.97)}}
  .shiver{animation:shiver .18s linear infinite;}
  @keyframes shiver{0%{transform:translate(0,0)}25%{transform:translate(-2px,1px)}50%{transform:translate(2px,-1px)}75%{transform:translate(-1px,-1px)}100%{transform:translate(1px,1px)}}
  .eggwob{animation:eggwob 2.2s ease-in-out infinite;}
  @keyframes eggwob{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
  .zzz{position:absolute;animation:zzzFloat 2.4s ease-out infinite;font-weight:800;}
  @keyframes zzzFloat{0%{opacity:0;transform:translate(0,0) scale(.6)}30%{opacity:.9}100%{opacity:0;transform:translate(24px,-46px) scale(1.2)}}
  .pop{animation:pop .4s cubic-bezier(.2,1.5,.4,1);}
  @keyframes pop{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}
  .sparkle{position:absolute;animation:spark 1.6s ease-in-out infinite;}
  @keyframes spark{0%,100%{opacity:.2;transform:scale(.7)}50%{opacity:1;transform:scale(1.1)}}
  .gaugefill{transition:width .5s cubic-bezier(.4,0,.2,1);}
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel" data-presets="classic-react">
const { useState, useRef, useEffect, useCallback } = React;

/* ===== 커스텀 훅: 안전한 인터벌 (게이지 폭주 방지) ===== */
function useInterval(cb, delay){
  const saved=useRef(cb);
  useEffect(()=>{ saved.current=cb; },[cb]);
  useEffect(()=>{ if(delay==null)return;
    const id=setInterval(()=>saved.current(),delay);
    return ()=>clearInterval(id); },[delay]);
}

const HOUR_MS=3000;         // 현실 3초 = 게임 1시간
const BABY_AT=6;            // 6시간에 부화(알→아기)
const ADULT_AT=30;         // 30시간에 어른

const clamp=v=>Math.max(0,Math.min(100,v));

/* 성장/성격별 몽글이 팔레트 */
function palette(stage, personality){
  if(stage==="baby") return {body:"#ffd1e8", bodyD:"#ff9ecb", belly:"#fff2f8", cheek:"#ff8fbf", accent:"#ff7fb6"};
  if(personality==="lively") return {body:"#ffe08a", bodyD:"#f7b733", belly:"#fff8e0", cheek:"#f97316", accent:"#fb923c"};
  if(personality==="calm")   return {body:"#c9ecff", bodyD:"#8fd0f5", belly:"#f0faff", cheek:"#7fb4e8", accent:"#a5b4fc"};
  if(personality==="grumpy") return {body:"#c8b8e6", bodyD:"#9d84c9", belly:"#efe9fb", cheek:"#8b6fb8", accent:"#7c5bb0"};
  return {body:"#ffd1e8", bodyD:"#ff9ecb", belly:"#fff2f8", cheek:"#ff8fbf", accent:"#ff7fb6"};
}
/* 표정 상태 결정 */
function expr(mood, sick, sleeping){
  if(sleeping) return "sleep";
  if(sick) return "sick";
  if(mood<25) return "sad";
  if(mood>=75) return "happy";
  return "ok";
}

/* ===== 귀여운 몽글이 SVG 캐릭터 ===== */
function MonggleChar({stage, mood, sick, sleeping, personality, size}){
  const S=size||150;
  const pal=palette(stage,personality);
  const e=expr(mood,sick,sleeping);
  const uid=React.useId().replace(/[^a-z0-9]/gi,"");

  /* ---- 알 ---- */
  if(stage==="egg"){
    return (
      <svg viewBox="0 0 150 150" width={S} height={S}>
        <defs>
          <radialGradient id={"eg"+uid} cx="40%" cy="34%" r="72%">
            <stop offset="0" stopColor="#fffdf7"/><stop offset="1" stopColor="#ffe9c7"/>
          </radialGradient>
        </defs>
        <ellipse cx="75" cy="128" rx="34" ry="7" fill="rgba(180,140,170,.25)"/>
        <path d="M75 20 C104 20 118 62 118 88 C118 116 100 134 75 134 C50 134 32 116 32 88 C32 62 46 20 75 20 Z"
          fill={"url(#eg"+uid+")"} stroke="#f4d29a" strokeWidth="2"/>
        {/* 파스텔 점무늬 */}
        <circle cx="60" cy="70" r="7" fill="#ffd1e8"/>
        <circle cx="92" cy="86" r="9" fill="#c9ecff"/>
        <circle cx="70" cy="104" r="6" fill="#d9f7d0"/>
        <circle cx="95" cy="58" r="5" fill="#fff0b0"/>
        {/* 반짝이 하이라이트 */}
        <ellipse cx="58" cy="46" rx="9" ry="13" fill="#ffffff" opacity=".55" transform="rotate(-20 58 46)"/>
        <text x="103" y="40" fontSize="14">✨</text>
      </svg>
    );
  }

  const R=stage==="baby"?32:40;          // 몸통 크기
  const cy=stage==="baby"?72:66;
  /* 눈/입 좌표 */
  const eyeY=cy-6, eyeDx=stage==="baby"?12:15, eyeR=stage==="baby"?7:8.5;

  function Eyes(){
    if(e==="sleep"){ // 감은 행복한 눈 ⌒⌒
      return (<g stroke="#5b3b52" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d={"M"+(75-eyeDx-6)+" "+eyeY+" q6 6 12 0"}/>
        <path d={"M"+(75+eyeDx-6)+" "+eyeY+" q6 6 12 0"}/></g>);
    }
    if(e==="sick"){ // >< 아픈 눈
      return (<g stroke="#5b3b52" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d={"M"+(75-eyeDx-5)+" "+(eyeY-4)+" l6 4 l-6 4"}/>
        <path d={"M"+(75+eyeDx+5)+" "+(eyeY-4)+" l-6 4 l6 4"}/></g>);
    }
    // 눈알 + 하이라이트
    const closed = e==="sad";
    return (<g>
      {[75-eyeDx,75+eyeDx].map((ex,i)=>(
        <g key={i}>
          <ellipse cx={ex} cy={eyeY} rx={eyeR} ry={closed?eyeR*0.78:eyeR*1.12} fill="#4a2f45"/>
          <circle cx={ex-eyeR*0.34} cy={eyeY-eyeR*0.5} r={eyeR*0.42} fill="#fff"/>
          <circle cx={ex+eyeR*0.3} cy={eyeY+eyeR*0.4} r={eyeR*0.18} fill="#fff" opacity=".8"/>
        </g>))}
      {/* 성격: 삐뚤이 눈썹 */}
      {personality==="grumpy" && e!=="sad" && (
        <g stroke="#5b3b52" strokeWidth="3" strokeLinecap="round">
          <path d={"M"+(75-eyeDx-8)+" "+(eyeY-eyeR-5)+" l14 5"}/>
          <path d={"M"+(75+eyeDx+8)+" "+(eyeY-eyeR-5)+" l-14 5"}/></g>)}
      {/* 슬픔: 눈물 */}
      {e==="sad" && <ellipse cx={75+eyeDx+eyeR} cy={eyeY+eyeR+2} rx="2.6" ry="4" fill="#8fd0f5"/>}
    </g>);
  }
  function Mouth(){
    const my=cy+9;
    if(e==="sleep") return <ellipse cx="75" cy={my} rx="4" ry="3" fill="#c76b91"/>;
    if(e==="sad") return <path d={"M69 "+(my+3)+" q6 -6 12 0"} stroke="#c76b91" strokeWidth="2.6" fill="none" strokeLinecap="round"/>;
    if(e==="sick") return <path d={"M68 "+my+" q3.5 4 7 0 q3.5 -4 7 0"} stroke="#c76b91" strokeWidth="2.4" fill="none" strokeLinecap="round"/>;
    if(e==="grumpy"||personality==="grumpy") return <path d={"M69 "+(my+2)+" q6 -3 12 0"} stroke="#c76b91" strokeWidth="2.6" fill="none" strokeLinecap="round"/>;
    if(e==="happy") return <path d={"M67 "+my+" q8 10 16 0 Z"} fill="#c76b91"/>; // 방긋
    return <path d={"M70 "+my+" q5 6 10 0"} stroke="#c76b91" strokeWidth="2.6" fill="none" strokeLinecap="round"/>;
  }

  return (
    <svg viewBox="0 0 150 150" width={S} height={S}>
      <defs>
        <radialGradient id={"bg"+uid} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".55"/>
          <stop offset="18%" stopColor={pal.body}/>
          <stop offset="100%" stopColor={pal.bodyD}/>
        </radialGradient>
      </defs>
      {/* 그림자 */}
      <ellipse cx="75" cy={cy+R+8} rx={R*0.85} ry="7" fill="rgba(180,140,170,.25)"/>
      {/* 성격별 머리 장식 (몸 뒤) */}
      {personality==="lively" && (
        <g fill={pal.bodyD} stroke={pal.accent} strokeWidth="2">
          <path d={"M"+(75-16)+" "+(cy-R+6)+" l-6 -22 l16 12 Z"}/>
          <path d={"M"+(75+16)+" "+(cy-R+6)+" l6 -22 l-16 12 Z"}/></g>)}
      {personality==="grumpy" && (
        <g fill={pal.bodyD}>
          <path d={"M"+(75-14)+" "+(cy-R+8)+" l-4 -16 l12 10 Z"}/>
          <path d={"M75 "+(cy-R+2)+" l0 -18 l9 14 Z"}/>
          <path d={"M"+(75+14)+" "+(cy-R+8)+" l4 -16 l-12 10 Z"}/></g>)}
      {/* 발 */}
      <ellipse cx={75-R*0.45} cy={cy+R+2} rx="9" ry="6" fill={pal.bodyD}/>
      <ellipse cx={75+R*0.45} cy={cy+R+2} rx="9" ry="6" fill={pal.bodyD}/>
      {/* 팔 */}
      <ellipse cx={75-R-2} cy={cy+6} rx="8" ry="11" fill={pal.body} stroke={pal.bodyD} strokeWidth="1.5"/>
      <ellipse cx={75+R+2} cy={cy+6} rx="8" ry="11" fill={pal.body} stroke={pal.bodyD} strokeWidth="1.5"/>
      {/* 몸통 (말랑 블롭) */}
      <path d={"M75 "+(cy-R)+
        " C"+(75+R*1.15)+" "+(cy-R)+" "+(75+R*1.1)+" "+(cy+R)+" 75 "+(cy+R)+
        " C"+(75-R*1.1)+" "+(cy+R)+" "+(75-R*1.15)+" "+(cy-R)+" 75 "+(cy-R)+" Z"}
        fill={"url(#bg"+uid+")"} stroke={pal.bodyD} strokeWidth="2"/>
      {/* 배 */}
      <ellipse cx="75" cy={cy+R*0.42} rx={R*0.55} ry={R*0.42} fill={pal.belly} opacity=".75"/>
      {/* 아기 새싹 / 차분이 꽃 */}
      {stage==="baby" && (
        <g><path d="M75 34 q-2 -12 6 -16 q-3 8 0 14" fill="#7ed957" stroke="#5cb54a" strokeWidth="1.2"/>
           <circle cx="75" cy="33" r="3.5" fill="#5cb54a"/></g>)}
      {personality==="calm" && (
        <g transform="translate(52,30)">
          {[0,1,2,3,4].map(i=><ellipse key={i} cx="0" cy="-6" rx="4" ry="6" fill="#fbcfe8"
            transform={"rotate("+(i*72)+" 0 0)"}/>)}
          <circle cx="0" cy="0" r="3.5" fill="#fde047"/></g>)}
      {/* 볼터치 */}
      <ellipse cx={75-eyeDx-6} cy={eyeY+9} rx="6.5" ry="4.5" fill={pal.cheek} opacity=".55"/>
      <ellipse cx={75+eyeDx+6} cy={eyeY+9} rx="6.5" ry="4.5" fill={pal.cheek} opacity=".55"/>
      <Eyes/>
      <Mouth/>
      {/* 활발이 별 볼 / 반짝 */}
      {personality==="lively" && e!=="sick" && e!=="sleep" &&
        <text x={75+eyeDx+2} y={eyeY-eyeR-4} fontSize="11">⭐</text>}
    </svg>
  );
}

function Game(){
  /* --- 게이지/상태 --- */
  const [hunger,setHunger]=useState(80);
  const [mood,setMood]=useState(80);
  const [energy,setEnergy]=useState(80);
  const [ageH,setAgeH]=useState(0);          // 나이(시간)
  const [stage,setStage]=useState("egg");    // egg|baby|adult
  const [sick,setSick]=useState(false);
  const [sleeping,setSleeping]=useState(false);
  const [personality,setPersonality]=useState(null); // lively|calm|grumpy
  const [act,setAct]=useState("idle");       // idle|munch|play|sleep
  const [floaters,setFloaters]=useState([]);
  const [evolveFx,setEvolveFx]=useState(false);
  const [toast,setToast]=useState("알을 소중히 품어주세요...");
  const [tab,setTab]=useState(null);         // 진화 안내 모달

  /* --- 케어 통계(성격 분기용) --- */
  const care=useRef({play:0, feed:0, sleep:0, neglect:0});
  const wasSad=useRef(false);
  const actTimer=useRef(null);
  const fid=useRef(1);

  const say=useCallback((m)=>{ setToast(m); },[]);
  function floatEmoji(emoji){
    const id=fid.current++; const left=30+Math.random()*40;
    setFloaters(f=>[...f,{id,emoji,left}]);
    setTimeout(()=>setFloaters(f=>f.filter(x=>x.id!==id)),1300);
  }
  function pulseAct(a,ms){ setAct(a); clearTimeout(actTimer.current);
    actTimer.current=setTimeout(()=>setAct("idle"),ms||500); }

  /* ===== 핵심 루프: 1시간마다 ===== */
  useInterval(()=>{
    // 알 단계: 게이지 감소 없이 부화 카운트만
    setAgeH(a=>a+1);
    if(sleeping){
      // 자는 중엔 피로만 빠르게 회복, 배고픔만 소폭 감소
      setEnergy(e=>clamp(e+18));
      setHunger(h=>clamp(h-2));
      return;
    }
    if(stage==="egg") return;
    setHunger(h=>clamp(h-6));
    setMood(m=>clamp(m-5));
    setEnergy(e=>clamp(e-4));
  }, HOUR_MS);

  /* 부화/진화 처리 */
  useEffect(()=>{
    if(stage==="egg" && ageH>=BABY_AT){
      setStage("baby"); triggerEvolve(); say("몽글이가 태어났어요! 🐣");
    } else if(stage==="baby" && ageH>=ADULT_AT){
      const c=care.current;
      let p="calm";
      if(c.neglect>=3) p="grumpy";
      else if(c.play>=4 && c.play>c.feed+c.sleep) p="lively";
      else p="calm";
      setPersonality(p);
      setStage("adult"); triggerEvolve();
      say(p==="lively"?"활발한 몽글이로 자랐어요! 🐲":p==="grumpy"?"삐뚤어진 몽글이가 됐어요... 😼":"차분한 몽글이로 자랐어요! 🦄");
    }
  },[ageH,stage,say]);

  function triggerEvolve(){ setEvolveFx(true); setTimeout(()=>setEvolveFx(false),1200);
    for(let i=0;i<6;i++)setTimeout(()=>floatEmoji("✨"),i*90); }

  /* 삐짐/아픔 패널티 */
  useEffect(()=>{
    if(stage==="egg")return;
    const sad=(hunger<=20||mood<=20);
    if(sad && !wasSad.current){ wasSad.current=true; }
    if(!sad) wasSad.current=false;
    if((hunger<=0||mood<=0) && !sick){
      setSick(true); care.current.neglect++; say("몽글이가 아파요... 치료해주세요! 🤒");
    }
  },[hunger,mood,stage,sick,say]);

  const isSad=(hunger<=20||mood<=20)&&!sick&&stage!=="egg"&&!sleeping;

  /* ===== 액션 ===== */
  function feed(){
    if(sick||sleeping||stage==="egg")return;
    care.current.feed++;
    setHunger(h=>clamp(h+26)); setEnergy(e=>clamp(e-2));
    pulseAct("munch",450); floatEmoji("🍰"); say("냠냠! 맛있어요 😋");
  }
  function play(){
    if(sick||sleeping||stage==="egg")return;
    if(energy<12){ say("너무 피곤해서 못 놀아요... 💤"); floatEmoji("💦"); return; }
    care.current.play++;
    setMood(m=>clamp(m+24)); setEnergy(e=>clamp(e-14));
    pulseAct("play",1400); floatEmoji("❤️"); say("신난다! 꺄르륵 🎵");
  }
  function sleepToggle(){
    if(sick||stage==="egg")return;
    if(!sleeping){ setSleeping(true); care.current.sleep++; setAct("sleep"); say("쉿... 몽글이가 자고 있어요 😴"); }
    else { setSleeping(false); setAct("idle"); say("잘 잤어요! 개운해요 ☀️"); }
  }
  function heal(){
    if(!sick)return;
    setSick(false); setHunger(h=>clamp(Math.max(h,45))); setMood(m=>clamp(Math.max(m,45)));
    floatEmoji("💊"); floatEmoji("💗"); say("다 나았어요! 고마워요 💗");
  }

  function reset(){
    setHunger(80);setMood(80);setEnergy(80);setAgeH(0);setStage("egg");
    setSick(false);setSleeping(false);setPersonality(null);setAct("idle");
    care.current={play:0,feed:0,sleep:0,neglect:0}; wasSad.current=false;
    say("새로운 알을 품어요... 🥚");
  }

  const disabled = sick || sleeping || stage==="egg";
  const dayNum=Math.floor(ageH/24)+1;
  const animClass = stage==="egg"?"eggwob"
    : sick?"shiver"
    : sleeping?"sleepbob"
    : act==="play"?"bounce"
    : act==="munch"?"munch"
    : "idle";

  const stageLabel = stage==="egg"?"알":stage==="baby"?"아기":
    (personality==="lively"?"활발한 어른":personality==="grumpy"?"삐뚤어진 어른":"차분한 어른");

  /* 배경: 자는 중엔 어둡게 */
  const bgOuter = sleeping
    ? "linear-gradient(160deg,#1e1b4b,#312e5f)"
    : "linear-gradient(160deg,#fef9c3,#fde4f0 55%,#dbeafe)";
  const bgInner = sleeping
    ? "linear-gradient(180deg,#2a2650,#3b3570)"
    : "linear-gradient(180deg,#fffdf5,#fdf2f8)";

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4"
      style={{background:bgOuter, transition:"background .8s ease"}}>
      {/* 세로형 모바일 컨테이너 */}
      <div className="soft rounded-[38px] w-[380px] max-w-full p-5 pt-4 relative overflow-hidden"
        style={{background:bgInner, transition:"background .8s ease", border:"1px solid rgba(255,255,255,.6)"}}>

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className={"font-black text-lg "+(sleeping?"text-indigo-100":"text-pink-500")}>🌸 몽글이</div>
            <div className={"text-[11px] font-bold "+(sleeping?"text-indigo-300":"text-pink-300")}>
              {dayNum}일차 · {stageLabel}</div>
          </div>
          <button onClick={reset}
            className={"btnpop text-[11px] font-bold px-3 py-1.5 rounded-full "+(sleeping?"bg-white/10 text-indigo-100":"bg-pink-100 text-pink-500")}>
            🔄 새 알
          </button>
        </div>

        {/* 게이지 */}
        <div className="space-y-1.5 mb-2">
          <Gauge label="배고픔" icon="🍚" val={hunger} from="#fbbf24" to="#f59e0b" dark={sleeping}/>
          <Gauge label="기분"   icon="😊" val={mood}   from="#f472b6" to="#ec4899" dark={sleeping}/>
          <Gauge label="피로도" icon="⚡" val={energy} from="#38bdf8" to="#0ea5e9" dark={sleeping}/>
        </div>

        {/* 무대 */}
        <div className="relative rounded-[28px] my-3 h-[230px] flex items-center justify-center overflow-hidden"
          style={{background: sleeping
            ? "radial-gradient(circle at 50% 40%, #3f3a78, #241f4d)"
            : "radial-gradient(circle at 50% 35%, #fffef7, #fce7f3)",
            transition:"background .8s ease"}}>
          {/* 배경 장식 */}
          {!sleeping && <>
            <div className="sparkle" style={{top:"18%",left:"16%",fontSize:"14px"}}>✨</div>
            <div className="sparkle" style={{top:"26%",right:"18%",fontSize:"18px",animationDelay:".6s"}}>⭐</div>
            <div className="sparkle" style={{bottom:"18%",left:"22%",fontSize:"12px",animationDelay:"1s"}}>✨</div>
            <div className="absolute bottom-3 text-3xl opacity-70">🌿🌸🌿</div>
          </>}
          {sleeping && <>
            <div className="sparkle" style={{top:"16%",left:"20%",fontSize:"14px",color:"#c7d2fe"}}>⭐</div>
            <div className="sparkle" style={{top:"22%",right:"22%",fontSize:"12px",animationDelay:".8s",color:"#c7d2fe"}}>✨</div>
            <div className="absolute top-4 right-8 text-3xl">🌙</div>
          </>}

          {/* 몽글이 */}
          <div className="relative z-10 flex items-center justify-center" style={{width:"140px",height:"140px"}}>
            <div className={evolveFx?"pop":""}>
              <div className={animClass} style={{filter:"drop-shadow(0 8px 10px rgba(180,120,160,.35))"}}>
                <MonggleChar stage={stage} mood={mood} sick={sick} sleeping={sleeping} personality={personality} size={140}/>
              </div>
            </div>
            {/* 삐짐 표시 */}
            {isSad && <div className="absolute -top-1 -right-2 text-2xl pop">💢</div>}
            {/* 자는 중 Zzz */}
            {sleeping && <>
              <div className="zzz text-indigo-200" style={{top:"6px",right:"22px",fontSize:"18px"}}>z</div>
              <div className="zzz text-indigo-200" style={{top:"0px",right:"8px",fontSize:"24px",animationDelay:".8s"}}>Z</div>
            </>}
            {/* 진화 후광 */}
            {evolveFx && <div className="absolute inset-0 rounded-full" style={{boxShadow:"0 0 50px 18px rgba(253,224,71,.6)"}}></div>}
            {/* 플로팅 이모지 */}
            {floaters.map(f=>(
              <span key={f.id} className="float" style={{left:f.left+"%",bottom:"40%"}}>{f.emoji}</span>
            ))}
          </div>
        </div>

        {/* 말풍선 */}
        <div className={"rounded-2xl px-4 py-2 text-center text-sm font-bold mb-3 "+(sleeping?"bg-white/10 text-indigo-100":"bg-white text-pink-500 soft")}
          style={{minHeight:"38px"}}>
          {sick ? "🤒 몽글이가 아파요..." : toast}
        </div>

        {/* 버튼 4개 */}
        <div className="grid grid-cols-2 gap-2.5">
          <ActBtn onClick={feed} disabled={disabled} color="#fdba74" bg="#fff7ed" icon="🍰" label="먹이 주기"/>
          <ActBtn onClick={play} disabled={disabled} color="#f9a8d4" bg="#fdf2f8" icon="🎾" label="놀아 주기"/>
          <ActBtn onClick={sleepToggle} disabled={sick||stage==="egg"} color="#a5b4fc" bg="#eef2ff"
            icon={sleeping?"☀️":"🌙"} label={sleeping?"깨우기":"재우기"} active={sleeping}/>
          <ActBtn onClick={heal} disabled={!sick} color="#86efac" bg="#f0fdf4" icon="💊" label="치료하기" urgent={sick}/>
        </div>

        {/* 진화 안내 */}
        <button onClick={()=>setTab(t=>t?null:"info")}
          className={"btnpop mt-3 w-full text-[11px] font-bold py-2 rounded-xl "+(sleeping?"bg-white/10 text-indigo-200":"bg-purple-50 text-purple-400")}>
          📖 성격 진화 가이드 {tab?"▲":"▼"}
        </button>
        {tab==="info" && (
          <div className="mt-2 rounded-xl bg-white/80 p-3 text-[11px] text-slate-600 leading-relaxed pop soft">
            <div className="font-bold text-purple-500 mb-1">🥚 알 → 🐣 아기(6시간) → 어른(30시간)</div>
            <div>🐲 <b className="text-orange-400">활발한</b>: '놀아주기'를 가장 많이 해준 경우</div>
            <div>🦄 <b className="text-sky-400">차분한</b>: '먹이'와 '재우기'를 규칙적으로</div>
            <div>😼 <b className="text-rose-400">삐뚤어진</b>: 아픔/방치를 3번 이상 겪은 경우</div>
            <div className="mt-1 text-slate-400">현재 케어 — 🎾{care.current.play} 🍰{care.current.feed} 🌙{care.current.sleep} 💢{care.current.neglect}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Gauge({label,icon,val,from,to,dark}){
  const low=val<=20;
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm w-5 text-center">{icon}</span>
      <span className={"text-[10px] font-bold w-9 "+(dark?"text-indigo-200":"text-slate-400")}>{label}</span>
      <div className={"flex-1 h-3.5 rounded-full overflow-hidden "+(dark?"bg-white/15":"bg-slate-100")}>
        <div className="gaugefill h-full rounded-full"
          style={{width:val+"%",background:low?"linear-gradient(90deg,#f87171,#ef4444)":"linear-gradient(90deg,"+from+","+to+")"}}></div>
      </div>
      <span className={"text-[10px] font-black w-7 text-right "+(low?"text-red-400":dark?"text-indigo-100":"text-slate-500")}>{Math.round(val)}</span>
    </div>
  );
}

function ActBtn({onClick,disabled,color,bg,icon,label,active,urgent}){
  return (
    <button onClick={onClick} disabled={disabled}
      className={"btnpop rounded-2xl py-3 flex flex-col items-center gap-0.5 font-bold text-sm border-2 "+(urgent?"animate-pulse":"")}
      style={{background:disabled?"#f1f5f9":bg, borderColor:disabled?"#e2e8f0":color,
        color:disabled?"#cbd5e1":"#64748b", opacity:disabled?0.55:1,
        boxShadow:active?("0 0 0 3px "+color):(disabled?"none":"0 4px 0 "+color+"55"),
        cursor:disabled?"not-allowed":"pointer"}}>
      <span className="text-2xl">{icon}</span>
      <span style={{color:disabled?"#cbd5e1":color}}>{label}</span>
    </button>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Game/>);
</script>
</body>
</html>'''


def monggle_page():
    st.title("🌸 다마고치: 몽글이 키우기")
    st.caption("파스텔 힐링 육성! 먹이·놀이·잠으로 몽글이를 돌보며 알→아기→어른으로. 케어 방식에 따라 활발/차분/삐뚤어진 성격으로 진화해요")
    components.html(MONGGLE_HTML, height=760, scrolling=True)


# ==========================================
# 7-5. 좀비 디펜스 FPS (React 임베드)
# ==========================================
ZOMBIE_FPS_HTML = r'''<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<script src="https://cdn.tailwindcss.com"></script>
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script>
  Babel.registerPreset('classic-react', { presets: [[Babel.availablePresets['react'], { runtime: 'classic' }]] });
</script>
<style>
  html,body{margin:0;padding:0;background:#0a0a0c;overflow-x:hidden;font-family:ui-sans-serif,system-ui,'Segoe UI',sans-serif;}
  #root{min-height:100vh;}
  .glass{background:rgba(20,20,26,.6);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.09);}
  canvas{display:block;border-radius:12px;cursor:none;}
  .btng{transition:transform .1s, filter .1s;}
  .btng:hover{transform:translateY(-2px);filter:brightness(1.12);}
  .btng:active{transform:translateY(1px);}
  .pop{animation:pop .3s cubic-bezier(.2,1.5,.4,1);}
  @keyframes pop{from{transform:scale(.7);opacity:0}to{transform:scale(1);opacity:1}}
  .warn{animation:wn .5s ease-in-out infinite alternate;}
  @keyframes wn{from{opacity:.55}to{opacity:1}}
  ::-webkit-scrollbar{height:7px;width:7px}::-webkit-scrollbar-thumb{background:#3f3f46;border-radius:8px}
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel" data-presets="classic-react">
const { useState, useRef, useEffect, useCallback } = React;

/* ===================== 상수 ===================== */
const W=820, H=560, HORIZON=168, LANES=5;
const rand=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/* 원근 좌표: lane(0..4), d(0=플레이어 앞, 1=지평선) → 화면 좌표+스케일 */
const NEAR_MARGIN=96;
function w2s(lane,d){
  const t=1-clamp(d,0,1);                    // 0 멀리, 1 가까이
  const vx=W/2, vy=HORIZON;
  const laneNearX=NEAR_MARGIN+(W-2*NEAR_MARGIN)*(lane/(LANES-1));
  const x=vx+(laneNearX-vx)*t;
  const y=vy+(H-46-vy)*t;
  const scale=0.26+1.55*t;
  return {x,y,scale};
}
function laneSpanNear(){ return (W-2*NEAR_MARGIN)/(LANES-1); }

/* 포탑 정의 */
const TURRETS={
  mg:    {name:"기관총 터렛", cost:75,  rate:9,  dmg:6,  color:"#fbbf24", range:1.05, splash:0, kind:"trace", desc:"빠른 연사"},
  cannon:{name:"캐논 터렛",   cost:130, rate:0.9,dmg:44, color:"#f97316", range:1.05, splash:0.16,kind:"shell", desc:"강력·광역"},
  flame: {name:"화염 터렛",   cost:105, rate:6,  dmg:5,  color:"#ef4444", range:0.5,  splash:0, kind:"flame",dot:true, desc:"근접 지속화상"},
  ice:   {name:"냉각 터렛",   cost:95,  rate:1.6,dmg:8,  color:"#38bdf8", range:1.0,  splash:0, kind:"trace", slow:1.6, desc:"둔화 저격"},
};
const BARRICADE={name:"바리케이드", cost:55, hp:220, color:"#a16207"};

/* ===================== 게임 ===================== */
function Game(){
  const cvRef=useRef(null);
  const zombies=useRef([]), builds=useRef([]), tracers=useRef([]), shells=useRef([]),
        globs=useRef([]), parts=useRef([]), floats=useRef([]), bloods=useRef([]);
  const player=useRef(null);
  const mouse=useRef({x:W/2,y:H*0.5,down:false});
  const keys=useRef({});
  const shake=useRef({t:0,mag:0});
  const wave=useRef(0), waveActive=useRef(false), spawnQ=useRef([]), spawnT=useRef(0), breakT=useRef(0);
  const money=useRef(300), kills=useRef(0);
  const running=useRef(true);
  const startedRef=useRef(false);  // "방어 시작" 이후 true. step()은 ref만 읽어야 하므로 phase(state) 대신 이걸 사용.
  const buildSelRef=useRef(null), demolishRef=useRef(false);
  const flashRef=useRef(0);
  const acc=useRef(0);
  const best=useRef(parseInt(localStorage.getItem("ynd_zd_best")||"0",10));

  const [ui,setUi]=useState({hp:100,money:300,wave:0,kills:0,ammo:30,mag:30,reloading:false,best:best.current});
  const [buildSel,setBuildSel]=useState(null);
  const [demolish,setDemolish]=useState(false);
  const [phase,setPhase]=useState("ready");     // ready|wave|break|over
  const [breakLeft,setBreakLeft]=useState(0);
  const [over,setOver]=useState(null);

  function newPlayer(){ return {hp:100,maxHp:100,ammo:30,mag:30,reloadT:0,fireCd:0,recoil:0,bob:0,hurtCd:0}; }
  const sync=useCallback(()=>{ const p=player.current; if(!p)return;
    setUi({hp:Math.max(0,Math.ceil(p.hp)),money:money.current,wave:wave.current,kills:kills.current,
      ammo:p.ammo,mag:p.mag,reloading:p.reloadT>0,best:best.current}); },[]);

  /* 슬롯 좌표 (lane × row) */
  const ROWS=[{d:0.34},{d:0.52}];
  function slotAt(mx,my){
    let bestS=null,bd=1e9;
    for(let l=0;l<LANES;l++)for(let r=0;r<ROWS.length;r++){
      const p=w2s(l,ROWS[r].d); const dd=(p.x-mx)**2+(p.y-my)**2;
      if(dd<bd){bd=dd;bestS={lane:l,row:r,d:ROWS[r].d,x:p.x,y:p.y};}
    }
    return bd<(70*70)?bestS:null;
  }
  function buildAt(lane,row){ return builds.current.find(b=>b.lane===lane&&b.row===row); }

  /* ===== 이펙트 ===== */
  function burst(x,y,color,n,pow){ for(let i=0;i<n;i++){const a=Math.random()*7,s=rand(.4,1)*(pow||90);
    parts.current.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:0,max:rand(.25,.55),size:rand(2,4.5),color});} }
  function bloodSplat(x,y,scale){ for(let i=0;i<9;i++){const a=Math.random()*7,s=rand(.3,1)*120*scale;
    parts.current.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-40,life:0,max:rand(.3,.6),size:rand(2,5)*scale,color:i%4?"#7f1d1d":"#b91c1c"});}
    bloods.current.push({x,y:y+6*scale,r:rand(6,12)*scale,life:0,max:6}); }
  function floatTxt(x,y,val,o){ floats.current.push(Object.assign({x,y,vy:-46,life:0,max:.7,val,color:"#f1f5f9",big:false},o||{})); }
  function shakeIt(t,m){ if(m>=shake.current.mag||shake.current.t<=0)shake.current={t,mag:m}; }

  /* ===== 웨이브 ===== */
  function startWave(){
    if(waveActive.current||!running.current)return;
    wave.current++;
    const w=wave.current; const q=[];
    const n=6+Math.floor(w*3.2);
    for(let i=0;i<n;i++){ let type="walker"; const rr=Math.random();
      if(w>=2&&rr<0.22)type="runner"; else if(w>=3&&rr<0.38)type="brute"; else if(w>=4&&rr<0.52)type="spitter";
      q.push({type,lane:Math.floor(Math.random()*LANES),at:i*Math.max(280,900-w*30)}); }
    if(w%5===0)q.push({type:"boss",lane:2,at:n*Math.max(280,900-w*30)+600});
    spawnQ.current=q; spawnT.current=0; waveActive.current=true; setPhase("wave"); sync();
  }
  function makeZombie(spec){
    const w=wave.current; const base=26*(1+w*0.5);
    let hp=base,sp=0.052,size=1,dmg=14,color="#4d7c0f",reward=8;
    if(spec.type==="runner"){hp*=0.5;sp=0.11;size=0.82;dmg=9;color="#65a30d";reward=7;}
    if(spec.type==="brute"){hp*=3.4;sp=0.032;size=1.5;dmg=32;color="#3f6212";reward=20;}
    if(spec.type==="spitter"){hp*=0.8;sp=0.045;size=0.95;dmg=8;color="#7c3aed";reward=14;}
    if(spec.type==="boss"){hp*=26;sp=0.026;size=2.4;dmg=55;color="#831843";reward=180;}
    return {id:Math.random(),type:spec.type,lane:spec.lane,d:1.0,hp:Math.round(hp),maxHp:Math.round(hp),
      sp,size,dmg,color,reward,flash:0,slow:0,atkCd:0,spitCd:rand(1.5,3),bob:Math.random()*7,dead:false};
  }

  /* ===== 플레이어 사격 ===== */
  function shoot(){
    const p=player.current;
    if(p.reloadT>0||p.fireCd>0)return;
    if(p.ammo<=0){ reload(); return; }
    p.ammo--; p.fireCd=1/10; p.recoil=1;
    shakeIt(.08,2.4);
    const mx=mouse.current.x,my=mouse.current.y;
    // 조준점 아래 가장 앞선(가까운) 좀비 명중
    let tgt=null,bestd=1e9;
    for(const z of zombies.current){ if(z.dead)continue; const s=w2s(z.lane,z.d);
      const rad=(16+z.size*10)*s.scale, hx=s.x, hy=s.y-14*s.scale*z.size;
      if((mx-hx)**2+(my-hy)**2 < (rad*1.15)**2){ if(z.d<bestd){bestd=z.d;tgt=z;tgt._s=s;} } }
    // 총구 화염 + 트레이서
    const gx=W/2, gy=H-30;
    tracers.current.push({x1:gx,y1:gy,x2:mx,y2:my,life:.06,color:"#fde68a"});
    burst(gx,gy-6,"#fef08a",4,60);
    if(tgt){ const s=tgt._s;
      const headY=s.y-(20+tgt.size*8)*s.scale;
      const head=(my<headY+10*s.scale);
      const dmg=head?30:12;
      dealDamage(tgt,dmg,{head,fx:s.x,fy:s.y});
    }
    sync();
  }
  function reload(){ const p=player.current; if(p.reloadT>0||p.ammo===p.mag)return;
    p.reloadT=1.3; }
  function dealDamage(z,dmg,o){
    o=o||{}; z.hp-=dmg; z.flash=1;
    if(o.slow)z.slow=Math.max(z.slow||0,o.slow);
    const s=w2s(z.lane,z.d);
    floatTxt(s.x,s.y-(28+z.size*10)*s.scale,Math.round(dmg),{big:o.head,color:o.head?"#f87171":"#f8fafc",label:o.head?"HEADSHOT!":null});
    bloodSplat(o.fx!=null?o.fx:s.x,o.fy!=null?o.fy:s.y,s.scale*z.size*0.7);
    if(o.head)shakeIt(.12,4);
    if(z.hp<=0&&!z.dead){ z.dead=true; kills.current++; money.current+=z.reward;
      floatTxt(s.x,s.y-40*s.scale,"+"+z.reward+"$",{color:"#fde047"});
      burst(s.x,s.y,z.color,z.type==="boss"?40:14,z.type==="boss"?200:110);
      if(z.type==="boss")shakeIt(.5,12); }
  }

  /* ===== 스텝 ===== */
  function step(dt){
    const p=player.current; if(!p)return;
    if(p.reloadT>0){ p.reloadT-=dt; if(p.reloadT<=0){ p.ammo=p.mag; sync(); } }
    if(p.fireCd>0)p.fireCd-=dt;
    if(p.recoil>0)p.recoil=Math.max(0,p.recoil-dt*5);
    if(p.hurtCd>0)p.hurtCd-=dt;
    p.bob+=dt*4;
    if(keys.current["r"])reload();
    if(mouse.current.down)shoot();

    /* 스폰 */
    if(waveActive.current){ spawnT.current+=dt*1000;
      while(spawnQ.current.length&&spawnQ.current[0].at<=spawnT.current){
        zombies.current.push(makeZombie(spawnQ.current.shift())); } }

    /* 좀비 이동/공격 */
    for(const z of zombies.current){ if(z.dead)continue;
      if(z.flash>0)z.flash-=dt*5;
      if(z.slow>0)z.slow-=dt;
      z.bob+=dt*(z.type==="runner"?12:6);
      // 앞을 막는 바리케이드
      let block=null;
      for(const b of builds.current){ if(b.kind!=="barricade"||b.lane!==z.lane||b.hp<=0)continue;
        if(z.d<=b.d+0.02 && b.d<z.d+0.5){ if(!block||b.d>block.d)block=b; } }
      if(block && z.d<=block.d+0.02){
        z.d=block.d; z.atkCd-=dt;
        if(z.atkCd<=0){ z.atkCd=0.8; block.hp-=z.dmg;
          const bs=w2s(block.lane,block.d); burst(bs.x,bs.y-10,"#a16207",5,70);
          if(block.hp<=0){ builds.current=builds.current.filter(x=>x!==block);
            const bs2=w2s(block.lane,block.d); burst(bs2.x,bs2.y,"#a16207",18,140); shakeIt(.2,5); } }
      } else {
        z.d-=z.sp*(z.slow>0?0.5:1)*dt;
        if(z.d<=0){ z.dead=true; p.hp-=z.dmg*0.4; p.hurtCd=0.6; flashRef.current=1;
          shakeIt(.3,8); sync(); }
      }
      // 스피터 원거리
      if(z.type==="spitter"&&z.d<0.7&&z.d>0.05){ z.spitCd-=dt;
        if(z.spitCd<=0){ z.spitCd=rand(2,3.4); const s=w2s(z.lane,z.d);
          globs.current.push({x:s.x,y:s.y-20*s.scale,tx:W/2,ty:H-40,life:0,max:1.0}); } }
    }
    zombies.current=zombies.current.filter(z=>!z.dead);

    /* 포탑 사격 */
    for(const b of builds.current){ if(b.kind==="barricade")continue;
      const T=TURRETS[b.kind]; b.cd=(b.cd||0)-dt;
      if(b.cd>0)continue;
      // 사거리 내 가장 앞선 좀비 (같은 lane ±1)
      let tgt=null,bestd=1e9;
      for(const z of zombies.current){ if(z.dead)continue;
        if(Math.abs(z.lane-b.lane)>1)continue;
        if(z.d>b.d+T.range)continue;
        if(z.d<bestd){bestd=z.d;tgt=z;} }
      if(!tgt)continue;
      b.cd=1/T.rate;
      const bp=w2s(b.lane,b.d), tp=w2s(tgt.lane,tgt.d);
      b.ang=Math.atan2(tp.y-bp.y,tp.x-bp.x);
      if(T.kind==="shell"){
        shells.current.push({x:bp.x,y:bp.y-10,tid:tgt.id,tx:tp.x,ty:tp.y,dmg:T.dmg,splash:T.splash,color:T.color,life:1.2});
      } else if(T.kind==="flame"){
        for(let i=0;i<3;i++)parts.current.push({x:bp.x,y:bp.y-8,vx:(tp.x-bp.x)*rand(.4,.8)/.3+rand(-20,20),vy:(tp.y-bp.y)*rand(.4,.8)/.3+rand(-20,20),life:0,max:.3,size:rand(3,6),color:i%2?"#fb923c":"#ef4444"});
        dealDamage(tgt,T.dmg,{fx:tp.x,fy:tp.y});
      } else { // trace (mg, ice)
        tracers.current.push({x1:bp.x,y1:bp.y-8,x2:tp.x,y2:tp.y-10*tp.scale*tgt.size,life:.05,color:T.color});
        burst(bp.x,bp.y-8,T.color,2,40);
        dealDamage(tgt,T.dmg,{slow:T.slow,fx:tp.x,fy:tp.y});
      }
    }
    /* 캐논 포탄 */
    for(const sh of shells.current){ sh.life-=dt;
      const z=zombies.current.find(x=>x.id===sh.tid&&!x.dead);
      let tx=sh.tx,ty=sh.ty; if(z){const tp=w2s(z.lane,z.d);tx=tp.x;ty=tp.y;}
      const dx=tx-sh.x,dy=ty-sh.y,dl=Math.hypot(dx,dy)||1,mv=520*dt;
      if(dl<=mv+10){ // 폭발
        burst(tx,ty,"#f97316",16,150); shakeIt(.14,4);
        const bd=w2s(0,0.5).scale; // approx
        for(const zz of zombies.current){ if(zz.dead)continue; const zp=w2s(zz.lane,zz.d);
          if(Math.abs(zp.x-tx)<70+sh.splash*300 && Math.abs(zp.y-ty)<50){ dealDamage(zz,sh.dmg,{fx:zp.x,fy:zp.y}); } }
        sh.dead=true;
      } else { sh.x+=dx/dl*mv; sh.y+=dy/dl*mv; }
    }
    shells.current=shells.current.filter(s=>!s.dead&&s.life>0);
    /* 스피터 글롭 */
    for(const g of globs.current){ g.life+=dt; const t=g.life/g.max;
      g.cx=g.x+(g.tx-g.x)*t; g.cy=g.y+(g.ty-g.y)*t-Math.sin(t*Math.PI)*60;
      if(g.life>=g.max){ g.dead=true; p.hp-=6; p.hurtCd=0.5; flashRef.current=0.7; burst(g.tx,g.ty,"#7c3aed",8,90); sync(); } }
    globs.current=globs.current.filter(g=>!g.dead);

    /* 트레이서/파티클/텍스트/피 */
    for(const t of tracers.current)t.life-=dt;
    tracers.current=tracers.current.filter(t=>t.life>0);
    for(const pt of parts.current){ pt.life+=dt; pt.x+=pt.vx*dt; pt.y+=pt.vy*dt; pt.vy+=200*dt; pt.vx*=0.95; }
    parts.current=parts.current.filter(pt=>pt.life<pt.max);
    if(parts.current.length>500)parts.current.splice(0,parts.current.length-500);
    for(const f of floats.current){ f.life+=dt; f.y+=f.vy*dt; f.vy+=40*dt; }
    floats.current=floats.current.filter(f=>f.life<f.max);
    for(const b of bloods.current)b.life+=dt;
    bloods.current=bloods.current.filter(b=>b.life<b.max);
    if(shake.current.t>0)shake.current.t-=dt;
    if(flashRef.current>0)flashRef.current-=dt*1.6;

    /* 웨이브 종료 → 휴식 */
    if(waveActive.current&&spawnQ.current.length===0&&zombies.current.length===0){
      waveActive.current=false; money.current+=40+wave.current*10;
      breakT.current=12; setPhase("break"); sync();
    }
    if(!waveActive.current&&running.current&&startedRef.current){
      if(breakT.current>0){ breakT.current-=dt; setBreakLeft(Math.ceil(breakT.current));
        if(breakT.current<=0)startWave(); }
    }
    /* 게임오버 */
    if(p.hp<=0&&running.current){ running.current=false;
      const sc=kills.current*10+wave.current*100;
      if(sc>best.current){best.current=sc;try{localStorage.setItem("ynd_zd_best",String(sc));}catch(_){}}
      setPhase("over"); setOver({wave:wave.current,kills:kills.current,score:sc,best:best.current}); }

    acc.current+=dt; if(acc.current>=0.1){acc.current=0;sync();}
  }

  /* ===== 렌더 ===== */
  function draw(now){
    const cv=cvRef.current; if(!cv)return; const ctx=cv.getContext("2d");
    const DPR=cv._dpr||1; ctx.setTransform(DPR,0,0,DPR,0,0);
    const p=player.current;
    let sx=0,sy=0; if(shake.current.t>0){const m=shake.current.mag*(shake.current.t/.3);sx=rand(-m,m);sy=rand(-m,m);}
    ctx.clearRect(0,0,W,H);
    ctx.save(); ctx.translate(sx,sy);
    /* 하늘 */
    const sky=ctx.createLinearGradient(0,0,0,HORIZON);
    sky.addColorStop(0,"#1a1730"); sky.addColorStop(1,"#3b1d2e");
    ctx.fillStyle=sky; ctx.fillRect(-8,-8,W+16,HORIZON+8);
    // 달
    ctx.fillStyle="#f1e9c9"; ctx.beginPath(); ctx.arc(W-90,52,26,0,7); ctx.fill();
    ctx.fillStyle="#3b1d2e"; ctx.beginPath(); ctx.arc(W-80,46,24,0,7); ctx.fill();
    /* 바닥 */
    const gr=ctx.createLinearGradient(0,HORIZON,0,H);
    gr.addColorStop(0,"#241f1a"); gr.addColorStop(1,"#12100d");
    ctx.fillStyle=gr; ctx.fillRect(-8,HORIZON,W+16,H-HORIZON+8);
    /* 원근 라인 */
    ctx.strokeStyle="rgba(120,110,90,.18)"; ctx.lineWidth=1;
    for(let l=0;l<LANES;l++){ const a=w2s(l,1),b=w2s(l,0);
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke(); }
    for(let dd=0.1;dd<1;dd+=0.12){ const a=w2s(0,dd),b=w2s(LANES-1,dd);
      ctx.globalAlpha=0.12*dd+0.05; ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke(); }
    ctx.globalAlpha=1;
    /* 핏자국 */
    for(const b of bloods.current){ ctx.globalAlpha=Math.max(0,0.5*(1-b.life/b.max));
      ctx.fillStyle="#5b1414"; ctx.beginPath(); ctx.ellipse(b.x,b.y,b.r,b.r*0.4,0,0,7); ctx.fill(); }
    ctx.globalAlpha=1;
    /* 건설 슬롯 (건설/철거 모드) */
    if(buildSelRef.current||demolishRef.current){
      const sl=slotAt(mouse.current.x,mouse.current.y);
      for(let l=0;l<LANES;l++)for(let r=0;r<ROWS.length;r++){ const s=w2s(l,ROWS[r].d);
        const occ=buildAt(l,r); const hov=sl&&sl.lane===l&&sl.row===r;
        ctx.globalAlpha=hov?0.5:0.22;
        ctx.strokeStyle=demolishRef.current?"#ef4444":occ?"#ef4444":"#22d3ee"; ctx.lineWidth=2;
        const sw=laneSpanNear()*s.scale*0.7;
        ctx.strokeRect(s.x-sw/2,s.y-sw*0.3,sw,sw*0.5);
      }
      ctx.globalAlpha=1;
    }
    /* 깊이 정렬 드로우 (좀비+건물) */
    const draws=[];
    for(const b of builds.current)draws.push({d:b.d+0.001,type:"build",o:b});
    for(const z of zombies.current)draws.push({d:z.d,type:"zombie",o:z});
    draws.sort((a,b)=>b.d-a.d);
    for(const it of draws){ if(it.type==="build")drawBuild(ctx,it.o,now); else drawZombie(ctx,it.o,now); }
    /* 글롭 */
    for(const g of globs.current){ ctx.fillStyle="#a855f7"; ctx.shadowColor="#a855f7"; ctx.shadowBlur=10;
      ctx.beginPath(); ctx.arc(g.cx||g.x,g.cy||g.y,7,0,7); ctx.fill(); ctx.shadowBlur=0; }
    /* 캐논 포탄 */
    for(const sh of shells.current){ ctx.fillStyle=sh.color; ctx.shadowColor=sh.color; ctx.shadowBlur=10;
      ctx.beginPath(); ctx.arc(sh.x,sh.y,5,0,7); ctx.fill(); ctx.shadowBlur=0; }
    /* 트레이서 */
    for(const t of tracers.current){ ctx.globalAlpha=Math.min(1,t.life*16);
      ctx.strokeStyle=t.color; ctx.lineWidth=2; ctx.shadowColor=t.color; ctx.shadowBlur=8;
      ctx.beginPath(); ctx.moveTo(t.x1,t.y1); ctx.lineTo(t.x2,t.y2); ctx.stroke(); ctx.shadowBlur=0; ctx.globalAlpha=1; }
    /* 파티클 */
    for(const pt of parts.current){ const a=1-pt.life/pt.max; ctx.globalAlpha=a; ctx.fillStyle=pt.color;
      ctx.beginPath(); ctx.arc(pt.x,pt.y,pt.size*a+0.5,0,7); ctx.fill(); }
    ctx.globalAlpha=1;
    /* 플로팅 텍스트 */
    for(const f of floats.current){ const a=1-f.life/f.max; ctx.globalAlpha=Math.max(0,a);
      ctx.font=(f.big?"bold 20px":"bold 13px")+" ui-monospace,monospace"; ctx.textAlign="center";
      ctx.lineWidth=3; ctx.strokeStyle="rgba(0,0,0,.7)"; ctx.fillStyle=f.color;
      ctx.strokeText(f.val,f.x,f.y); ctx.fillText(f.val,f.x,f.y);
      if(f.label){ ctx.font="bold 10px sans-serif"; ctx.fillStyle="#fca5a5"; ctx.fillText(f.label,f.x,f.y-16); } }
    ctx.globalAlpha=1;
    ctx.restore();
    /* 피격 붉은 화면 */
    if(flashRef.current>0){ ctx.fillStyle="rgba(220,20,20,"+Math.min(.5,flashRef.current*.5)+")"; ctx.fillRect(0,0,W,H); }
    /* 저체력 비네트 */
    if(p.hp<35&&running.current){ ctx.globalAlpha=.2+.12*Math.sin(now/180);
      const vg=ctx.createRadialGradient(W/2,H/2,H*0.3,W/2,H/2,H*0.75);
      vg.addColorStop(0,"transparent");vg.addColorStop(1,"#dc2626");
      ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);ctx.globalAlpha=1; }
    /* 1인칭 총 */
    drawGun(ctx,now,p);
    /* 크로스헤어 */
    const mx=mouse.current.x,my=mouse.current.y; const sp=6+p.recoil*10;
    ctx.strokeStyle=p.reloadT>0?"#f87171":"#fef08a"; ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(mx-sp-6,my);ctx.lineTo(mx-sp,my); ctx.moveTo(mx+sp,my);ctx.lineTo(mx+sp+6,my);
    ctx.moveTo(mx,my-sp-6);ctx.lineTo(mx,my-sp); ctx.moveTo(mx,my+sp);ctx.lineTo(mx,my+sp+6);
    ctx.stroke();
    ctx.fillStyle="#fef08a"; ctx.fillRect(mx-1,my-1,2,2);
    /* 재장전 바 */
    if(p.reloadT>0){ const w2=60,rp=1-p.reloadT/1.3;
      ctx.fillStyle="rgba(0,0,0,.6)";ctx.fillRect(mx-w2/2,my+22,w2,6);
      ctx.fillStyle="#fbbf24";ctx.fillRect(mx-w2/2,my+22,w2*rp,6);
      ctx.font="bold 10px sans-serif";ctx.fillStyle="#fff";ctx.textAlign="center";ctx.fillText("재장전",mx,my+38); }
  }
  function drawGun(ctx,now,p){
    const bob=Math.sin(p.bob)*3, recoil=p.recoil*16;
    ctx.save(); ctx.translate(0,recoil);
    // 팔/총열 (오른손 소총)
    ctx.fillStyle="#2a2a30";
    ctx.beginPath();
    ctx.moveTo(W*0.5-8,H); ctx.lineTo(W*0.5+2,H-70+bob); ctx.lineTo(W*0.5+30,H-84+bob);
    ctx.lineTo(W*0.5+60,H-70+bob); ctx.lineTo(W*0.62,H); ctx.closePath(); ctx.fill();
    // 총열
    ctx.strokeStyle="#3f3f46"; ctx.lineWidth=10; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(W*0.5+26,H-80+bob); ctx.lineTo(W*0.5+8,H-150+bob); ctx.stroke();
    ctx.strokeStyle="#18181b"; ctx.lineWidth=4;
    ctx.beginPath(); ctx.moveTo(W*0.5+26,H-80+bob); ctx.lineTo(W*0.5+8,H-150+bob); ctx.stroke();
    // 손
    ctx.fillStyle="#8a5a3b"; ctx.beginPath(); ctx.ellipse(W*0.5+30,H-70+bob,16,12,-.4,0,7); ctx.fill();
    // 총구 화염
    if(p.recoil>0.4){ ctx.fillStyle="rgba(255,220,120,"+(p.recoil)+")"; ctx.shadowColor="#fde047"; ctx.shadowBlur=20;
      ctx.beginPath(); ctx.arc(W*0.5+6,H-152+bob,10+p.recoil*8,0,7); ctx.fill(); ctx.shadowBlur=0; }
    ctx.restore();
  }
  function drawZombie(ctx,z,now){
    const s=w2s(z.lane,z.d); const sc=s.scale*z.size;
    ctx.save(); ctx.translate(s.x,s.y);
    // 그림자
    ctx.fillStyle="rgba(0,0,0,.4)"; ctx.beginPath(); ctx.ellipse(0,0,16*sc,5*sc,0,0,7); ctx.fill();
    const bob=Math.sin(z.bob)*2*sc;
    // 다리
    ctx.strokeStyle="#3f4a1a"; ctx.lineWidth=5*sc; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(-5*sc,-2); ctx.lineTo(-6*sc-bob,-16*sc); ctx.moveTo(5*sc,-2); ctx.lineTo(6*sc+bob,-16*sc); ctx.stroke();
    // 몸통
    ctx.fillStyle=z.color;
    ctx.beginPath(); ctx.ellipse(0,-30*sc+bob,13*sc,18*sc,0,0,7); ctx.fill();
    // 팔 (앞으로 뻗음)
    ctx.strokeStyle=z.color; ctx.lineWidth=6*sc;
    ctx.beginPath(); ctx.moveTo(-10*sc,-34*sc+bob); ctx.lineTo(-20*sc,-40*sc+bob);
    ctx.moveTo(10*sc,-34*sc+bob); ctx.lineTo(20*sc,-40*sc+bob); ctx.stroke();
    // 머리
    ctx.fillStyle="#6b8e23"; ctx.beginPath(); ctx.arc(0,-52*sc+bob,10*sc,0,7); ctx.fill();
    // 눈 (빨강)
    ctx.fillStyle="#ef4444"; ctx.shadowColor="#ef4444"; ctx.shadowBlur=6*sc;
    ctx.beginPath(); ctx.arc(-4*sc,-53*sc+bob,2*sc,0,7); ctx.arc(4*sc,-53*sc+bob,2*sc,0,7); ctx.fill(); ctx.shadowBlur=0;
    if(z.type==="boss"){ ctx.font=(14*sc)+"px sans-serif"; ctx.textAlign="center"; ctx.fillText("👑",0,-68*sc+bob); }
    if(z.type==="spitter"){ ctx.fillStyle="#a855f7"; ctx.beginPath(); ctx.arc(0,-30*sc+bob,5*sc,0,7); ctx.fill(); }
    // 둔화
    if(z.slow>0){ ctx.globalAlpha=.4; ctx.fillStyle="#38bdf8"; ctx.beginPath(); ctx.arc(0,-32*sc+bob,16*sc,0,7); ctx.fill(); ctx.globalAlpha=1; }
    // 피격 플래시
    if(z.flash>0){ ctx.globalAlpha=z.flash*.8; ctx.fillStyle="#fff"; ctx.beginPath(); ctx.ellipse(0,-34*sc+bob,15*sc,20*sc,0,0,7); ctx.fill(); ctx.globalAlpha=1; }
    // HP바
    const hw=30*sc,r=Math.max(0,z.hp/z.maxHp);
    ctx.fillStyle="rgba(0,0,0,.6)"; ctx.fillRect(-hw/2,-70*sc+bob,hw,4*sc);
    ctx.fillStyle=r>.5?"#84cc16":r>.25?"#eab308":"#ef4444"; ctx.fillRect(-hw/2,-70*sc+bob,hw*r,4*sc);
    ctx.restore();
  }
  function drawBuild(ctx,b,now){
    const s=w2s(b.lane,b.d); const sc=s.scale;
    ctx.save(); ctx.translate(s.x,s.y);
    if(b.kind==="barricade"){
      const bw=laneSpanNear()*sc*0.86;
      ctx.fillStyle="#78350f"; ctx.fillRect(-bw/2,-30*sc,bw,30*sc);
      ctx.strokeStyle="#451a03"; ctx.lineWidth=2*sc;
      for(let i=-1;i<=1;i++){ ctx.beginPath(); ctx.moveTo(i*bw/3,-30*sc); ctx.lineTo(i*bw/3,0); ctx.stroke(); }
      ctx.fillStyle="#a16207"; ctx.fillRect(-bw/2,-30*sc,bw,6*sc);
      // 철조망
      ctx.strokeStyle="#9ca3af"; ctx.lineWidth=1.5*sc;
      ctx.beginPath(); for(let x=-bw/2;x<bw/2;x+=8*sc){ctx.moveTo(x,-34*sc);ctx.lineTo(x+4*sc,-30*sc);} ctx.stroke();
      const hw=bw*0.8,r=Math.max(0,b.hp/b.maxHp);
      ctx.fillStyle="rgba(0,0,0,.6)"; ctx.fillRect(-hw/2,-42*sc,hw,4*sc);
      ctx.fillStyle=r>.5?"#84cc16":r>.25?"#eab308":"#ef4444"; ctx.fillRect(-hw/2,-42*sc,hw*r,4*sc);
    } else {
      const T=TURRETS[b.kind];
      // 대좌
      ctx.fillStyle="#27272a"; ctx.beginPath(); ctx.ellipse(0,0,18*sc,8*sc,0,0,7); ctx.fill();
      ctx.fillStyle="#3f3f46"; ctx.fillRect(-10*sc,-16*sc,20*sc,16*sc);
      // 포신
      ctx.save(); ctx.translate(0,-16*sc); ctx.rotate(b.ang||0);
      ctx.fillStyle=T.color; ctx.fillRect(0,-4*sc,24*sc,8*sc);
      ctx.fillStyle="#18181b"; ctx.fillRect(20*sc,-2.5*sc,8*sc,5*sc);
      ctx.restore();
      // 코어
      ctx.fillStyle=T.color; ctx.shadowColor=T.color; ctx.shadowBlur=8;
      ctx.beginPath(); ctx.arc(0,-16*sc,5*sc,0,7); ctx.fill(); ctx.shadowBlur=0;
    }
    ctx.restore();
  }

  /* ===== 루프/입력 ===== */
  useEffect(()=>{
    const cv=cvRef.current; const DPR=Math.min(2,window.devicePixelRatio||1);
    cv.width=W*DPR;cv.height=H*DPR;cv.style.width=W+"px";cv.style.height=H+"px";cv._dpr=DPR;
    player.current=newPlayer();
    let raf,last=performance.now(),accum=0;const STEP=1/60;
    const loop=(now)=>{ let dt=(now-last)/1000;last=now;if(dt>0.5)dt=0.5;accum+=dt;let g=0;
      while(accum>=STEP&&g++<40){ if(running.current)step(STEP); accum-=STEP; }
      if(accum>=STEP)accum=0; draw(now); raf=requestAnimationFrame(loop); };
    raf=requestAnimationFrame(loop);
    const kd=e=>{ keys.current[e.key.toLowerCase()]=true; if(e.key.toLowerCase()==="r")reload(); };
    const ku=e=>{ keys.current[e.key.toLowerCase()]=false; };
    const mm=e=>{ const r=cv.getBoundingClientRect(); mouse.current.x=(e.clientX-r.left)*(W/r.width); mouse.current.y=(e.clientY-r.top)*(H/r.height); };
    const md=e=>{ if(e.button!==0)return; const r=cv.getBoundingClientRect();
      const mx=(e.clientX-r.left)*(W/r.width),my=(e.clientY-r.top)*(H/r.height);
      mouse.current.x=mx;mouse.current.y=my;
      if(buildSelRef.current){ tryBuild(mx,my); return; }
      if(demolishRef.current){ tryDemolish(mx,my); return; }
      mouse.current.down=true; shoot(); };
    const mu=e=>{ if(e.button===0)mouse.current.down=false; };
    const ctxm=e=>{ e.preventDefault(); setBuildSel(null);buildSelRef.current=null; setDemolish(false);demolishRef.current=false; };
    window.addEventListener("keydown",kd);window.addEventListener("keyup",ku);
    cv.addEventListener("mousemove",mm);cv.addEventListener("mousedown",md);
    window.addEventListener("mouseup",mu);cv.addEventListener("contextmenu",ctxm);
    return ()=>{cancelAnimationFrame(raf);
      window.removeEventListener("keydown",kd);window.removeEventListener("keyup",ku);
      cv.removeEventListener("mousemove",mm);cv.removeEventListener("mousedown",md);
      window.removeEventListener("mouseup",mu);cv.removeEventListener("contextmenu",ctxm);};
  },[]);

  function tryBuild(mx,my){
    const kind=buildSelRef.current; const sl=slotAt(mx,my); if(!sl)return;
    if(buildAt(sl.lane,sl.row)){ return; }
    const cost=kind==="barricade"?BARRICADE.cost:TURRETS[kind].cost;
    if(money.current<cost){ flashRef.current=0.4; return; }
    money.current-=cost;
    if(kind==="barricade")builds.current.push({id:Math.random(),kind:"barricade",lane:sl.lane,row:sl.row,d:sl.d,hp:BARRICADE.hp,maxHp:BARRICADE.hp});
    else builds.current.push({id:Math.random(),kind,lane:sl.lane,row:sl.row,d:sl.d,cd:0,ang:0});
    const s=w2s(sl.lane,sl.d); burst(s.x,s.y,"#22d3ee",10,90); sync();
  }
  function tryDemolish(mx,my){
    const sl=slotAt(mx,my); if(!sl)return; const b=buildAt(sl.lane,sl.row); if(!b)return;
    const cost=b.kind==="barricade"?BARRICADE.cost:TURRETS[b.kind].cost;
    money.current+=Math.round(cost*0.6); builds.current=builds.current.filter(x=>x!==b);
    const s=w2s(sl.lane,sl.d); burst(s.x,s.y,"#ef4444",10,90); sync();
  }

  function selectBuild(k){ if(buildSel===k){setBuildSel(null);buildSelRef.current=null;}
    else{setBuildSel(k);buildSelRef.current=k;setDemolish(false);demolishRef.current=false;} }
  function toggleDemolish(){ const v=!demolish; setDemolish(v);demolishRef.current=v; setBuildSel(null);buildSelRef.current=null; }
  function restart(){
    zombies.current=[];builds.current=[];tracers.current=[];shells.current=[];globs.current=[];
    parts.current=[];floats.current=[];bloods.current=[];
    player.current=newPlayer(); mouse.current.down=false;
    wave.current=0;waveActive.current=false;spawnQ.current=[];breakT.current=0;money.current=300;kills.current=0;
    shake.current={t:0,mag:0};flashRef.current=0;running.current=true;startedRef.current=false;
    setBuildSel(null);buildSelRef.current=null;setDemolish(false);demolishRef.current=false;
    setOver(null);setPhase("ready");sync();
  }
  function beginFirst(){ startedRef.current=true; startWave(); }

  const items=[["barricade","🧱",BARRICADE.name,BARRICADE.cost],
    ["mg","🔫",TURRETS.mg.name,TURRETS.mg.cost],["cannon","💥",TURRETS.cannon.name,TURRETS.cannon.cost],
    ["flame","🔥",TURRETS.flame.name,TURRETS.flame.cost],["ice","❄️",TURRETS.ice.name,TURRETS.ice.cost]];

  return (
    <div className="min-h-screen w-full flex flex-col items-center p-3 text-slate-100"
      style={{background:"radial-gradient(900px 400px at 50% -10%, #3b0d0d55, transparent), #0a0a0c"}}>
      {/* HUD */}
      <div className="glass rounded-2xl px-4 py-2 mb-2 flex items-center gap-3 flex-wrap shadow-xl" style={{width:W}}>
        <div className="font-black text-lg bg-gradient-to-r from-red-400 to-amber-400 bg-clip-text text-transparent">🧟 좀비 디펜스 FPS</div>
        <div className="flex-1"></div>
        <span className="text-sm font-bold text-red-300">❤️ {ui.hp}</span>
        <span className="text-sm font-bold text-amber-300">💰 {ui.money}</span>
        <span className="text-sm font-bold text-lime-300">🌊 웨이브 {ui.wave}</span>
        <span className="text-sm font-bold text-slate-300">💀 {ui.kills}</span>
        <span className="text-sm font-bold text-yellow-300">🏆 {ui.best.toLocaleString()}</span>
      </div>

      <div className="relative">
        <canvas ref={cvRef} className="shadow-2xl" style={{border:"1px solid rgba(255,255,255,.08)"}}/>
        {/* 탄약 표시 */}
        <div className="absolute bottom-3 right-4 glass rounded-xl px-3 py-1.5 flex items-center gap-2">
          <span className="text-lg">🔫</span>
          <span className="font-black text-xl tabular-nums" style={{color:ui.reloading?"#f87171":"#fde047"}}>
            {ui.reloading?"R":ui.ammo}<span className="text-xs text-slate-400"> / {ui.mag}</span></span>
        </div>
        {/* 웨이브/휴식 배너 */}
        {phase==="ready"&&(
          <div className="absolute inset-0 flex items-center justify-center bg-black/55 rounded-xl">
            <div className="text-center pop">
              <div className="text-3xl font-black text-red-400 mb-2">🧟 좀비가 몰려온다!</div>
              <div className="text-sm text-slate-300 mb-4 leading-relaxed">
                🖱️ <b>마우스</b> 조준 · <b>클릭(홀드)</b> 사격 · <b>R</b> 재장전<br/>
                아래에서 <b>바리케이드</b>와 <b>포탑</b>을 사서 설치하고 방어하세요!</div>
              <button onClick={beginFirst} className="btng px-8 py-3 rounded-xl font-black text-slate-900 bg-gradient-to-r from-red-400 to-amber-400 shadow-lg">▶ 방어 시작</button>
            </div>
          </div>)}
        {phase==="break"&&breakLeft>0&&(
          <div className="absolute top-4 left-1/2 -translate-x-1/2 glass warn rounded-xl px-5 py-2 border-2 border-lime-500/60">
            <span className="font-black text-lime-300">웨이브 {ui.wave} 방어 성공! 다음 웨이브 {breakLeft}초 · 지금 보강하세요 🛠️</span>
          </div>)}
      </div>

      {/* 건설 바 */}
      <div className="glass rounded-2xl px-3 py-2 mt-2 shadow-xl" style={{width:W}}>
        <div className="flex items-center gap-2 flex-wrap">
          {items.map(([k,ic,nm,cost])=>{ const on=buildSel===k, can=ui.money>=cost;
            return (
              <button key={k} onClick={()=>selectBuild(k)}
                className={"btng rounded-xl px-3 py-1.5 flex items-center gap-2 border-2 "+(on?"ring-2":"")}
                style={{borderColor:on?"#22d3ee":"rgba(255,255,255,.12)",background:on?"#22d3ee22":"rgba(30,30,38,.6)",opacity:can?1:.5,boxShadow:on?"0 0 0 2px #22d3ee":"none"}}>
                <span className="text-xl">{ic}</span>
                <span className="text-left leading-tight"><div className="text-[11px] font-bold text-slate-100">{nm}</div>
                  <div className="text-[10px] text-amber-300">{cost}$</div></span>
              </button>); })}
          <button onClick={toggleDemolish}
            className={"btng rounded-xl px-3 py-2 font-bold text-sm border-2 "+(demolish?"ring-2":"")}
            style={{borderColor:demolish?"#ef4444":"rgba(255,255,255,.12)",background:demolish?"#ef444422":"rgba(30,30,38,.6)"}}>🔧 철거</button>
          <div className="flex-1"></div>
          <span className="text-[10px] text-slate-400">{buildSel?"설치할 슬롯을 클릭 (우클릭 취소)":demolish?"철거할 건물 클릭 (60% 환불)":"건설 아이템을 골라 설치하세요"}</span>
        </div>
      </div>

      {/* 게임 오버 */}
      {over&&(
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="glass rounded-2xl p-8 text-center pop max-w-sm w-full">
            <div className="text-6xl mb-2">🧟💀</div>
            <div className="text-2xl font-black text-red-400 mb-4">방어선이 뚫렸다...</div>
            <div className="grid grid-cols-3 gap-2 mb-3 text-sm">
              <div className="rounded-xl bg-white/5 p-2"><div className="text-slate-400 text-[11px]">웨이브</div><div className="text-2xl font-black text-lime-300">{over.wave}</div></div>
              <div className="rounded-xl bg-white/5 p-2"><div className="text-slate-400 text-[11px]">처치</div><div className="text-2xl font-black text-slate-200">{over.kills}</div></div>
              <div className="rounded-xl bg-white/5 p-2"><div className="text-slate-400 text-[11px]">점수</div><div className="text-2xl font-black text-amber-300">{over.score}</div></div>
            </div>
            <div className="text-xs text-slate-400 mb-4">🏆 최고 점수: <b className="text-yellow-300">{over.best.toLocaleString()}</b>{over.score>=over.best&&over.score>0?" — 신기록!":""}</div>
            <button onClick={restart} className="btng w-full py-3 rounded-xl font-black text-slate-900 bg-gradient-to-r from-red-400 to-amber-400 shadow-lg">🔄 다시 방어</button>
          </div>
        </div>)}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Game/>);
</script>
</body>
</html>'''


def zombie_fps_page():
    st.title("🧟 좀비 디펜스 FPS")
    st.caption("1인칭 시점! 마우스로 조준·클릭 사격(R 재장전)하며, 바리케이드로 길목을 막고 다양한 포탑을 설치해 몰려오는 좀비 웨이브를 방어하세요")
    components.html(ZOMBIE_FPS_HTML, height=820, scrolling=True)


# ==========================================
# 7-6. 개미굴 대전 RTS (React 임베드)
# ==========================================
ANT_WAR_HTML = r'''<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<script src="https://cdn.tailwindcss.com"></script>
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script>
  Babel.registerPreset('classic-react', { presets: [[Babel.availablePresets['react'], { runtime: 'classic' }]] });
</script>
<style>
  html,body{margin:0;padding:0;background:#0f0d0a;overflow-x:hidden;font-family:ui-sans-serif,system-ui,'Segoe UI',sans-serif;}
  #root{min-height:100vh;}
  .glass{background:rgba(30,24,16,.62);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.08);}
  canvas{display:block;border-radius:12px;}
  .btng{transition:transform .1s, filter .1s;}
  .btng:hover{transform:translateY(-2px);filter:brightness(1.1);}
  .btng:active{transform:translateY(1px);}
  .pop{animation:pop .3s cubic-bezier(.2,1.5,.4,1);}
  @keyframes pop{from{transform:scale(.7);opacity:0}to{transform:scale(1);opacity:1}}
  .fadein{animation:fadein .35s ease;}
  @keyframes fadein{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  ::-webkit-scrollbar{height:7px;width:7px}::-webkit-scrollbar-thumb{background:#57432a;border-radius:8px}
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel" data-presets="classic-react">
const { useState, useRef, useEffect, useCallback } = React;

/* ===================== 상수 ===================== */
const W=820, H=560;
const YOU="#f59e0b", YOU_D="#b45309", AI="#a855f7", AI_D="#6b21a8";
const rand=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const dist=(ax,ay,bx,by)=>Math.hypot(ax-bx,ay-by);

/* 개미 종류 스탯 */
const ANT={
  worker: {name:"일개미", icon:"🐜", hp:16, atk:2,  sp:36, cost:10, cd:0.5, gather:7,  vis:0 },
  soldier:{name:"병정개미",icon:"⚔️", hp:70, atk:10, sp:26, cost:28, cd:1.3, gather:0,  vis:150 },
  scout:  {name:"정찰개미",icon:"🦗", hp:24, atk:6,  sp:58, cost:18, cd:0.8, gather:0,  vis:170 },
};
const NEST_HP=1200;
const DIFF={
  easy:  {name:"쉬움",   ecoCd:1.5, wTarget:7,  push:7,  atkMul:1.0,  eco:1.0,  color:"#22c55e"},
  normal:{name:"보통",   ecoCd:1.05,wTarget:10, push:11, atkMul:1.18, eco:1.1,  color:"#eab308"},
  hard:  {name:"어려움", ecoCd:0.75,wTarget:13, push:14, atkMul:1.4,  eco:1.28, color:"#ef4444"},
};
const SAVE_KEY="ynd_ant_match_v1", REC_KEY="ynd_ant_record_v1";

function loadRecord(){ try{ return JSON.parse(localStorage.getItem(REC_KEY))||{w:0,l:0}; }catch(e){ return {w:0,l:0}; } }
function saveRecord(r){ try{ localStorage.setItem(REC_KEY,JSON.stringify(r)); }catch(e){} }
function loadMatch(){ try{ const o=JSON.parse(localStorage.getItem(SAVE_KEY)); if(o&&o.ants&&o.you&&o.you.hp>0&&o.ai.hp>0)return o; }catch(e){} return null; }
function clearMatch(){ try{ localStorage.removeItem(SAVE_KEY); }catch(e){} }

/* ===================== 게임 ===================== */
function Game(){
  const cvRef=useRef(null);
  const ants=useRef([]), foods=useRef([]), parts=useRef([]), floats=useRef([]);
  const you=useRef(null), ai=useRef(null);
  const idc=useRef(1);
  const phase=useRef("setup");           // setup|play|over
  const rally=useRef("defend");          // defend|attack (플레이어)
  const upg=useRef({you:{gather:0,combat:0}, ai:{gather:0,combat:0}});
  const spawnCd=useRef({you:{worker:0,soldier:0,scout:0}, ai:{worker:0,soldier:0,scout:0}});
  const aiBrain=useRef({mode:"eco", ecoT:0});
  const diff=useRef("normal");
  const foodRegen=useRef(0);
  const timeS=useRef(0);
  const shake=useRef({t:0,mag:0});
  const acc=useRef(0), saveAcc=useRef(0);
  const record=useRef(loadRecord());
  const savedMatch=useRef(loadMatch());

  const [ui,setUi]=useState({food:40, wk:0, sd:0, sc:0, yhp:NEST_HP, ahp:NEST_HP, time:0});
  const [phaseS,setPhaseS]=useState("setup");
  const [rallyS,setRallyS]=useState("defend");
  const [upgS,setUpgS]=useState({gather:0,combat:0});
  const [diffS,setDiffS]=useState("normal");
  const [result,setResult]=useState(null);
  const [rec,setRec]=useState(record.current);
  const [toast,setToast]=useState(null);
  const [hasSave,setHasSave]=useState(!!savedMatch.current);
  const [cds,setCds]=useState({worker:0,soldier:0,scout:0});

  const say=(m)=>{ setToast(m); setTimeout(()=>setToast(t=>t===m?null:t),2200); };
  const syncUi=useCallback(()=>{ const y=you.current,a=ai.current; if(!y)return;
    let wk=0,sd=0,sc=0; for(const an of ants.current){ if(an.side!=="you")continue;
      if(an.type==="worker")wk++; else if(an.type==="soldier")sd++; else sc++; }
    setUi({food:Math.floor(y.food),wk,sd,sc,yhp:Math.max(0,Math.ceil(y.hp)),ahp:Math.max(0,Math.ceil(a.hp)),time:Math.floor(timeS.current)});
    setCds({worker:Math.max(0,spawnCd.current.you.worker),soldier:Math.max(0,spawnCd.current.you.soldier),scout:Math.max(0,spawnCd.current.you.scout)});
  },[]);

  /* ---------- 초기화 ---------- */
  function freshFoods(){ const f=[]; for(let i=0;i<7;i++){ f.push({id:idc.current++,
    x:rand(120,W-120), y:rand(180,H-180), amt:rand(90,150), max:150}); } return f; }
  function newMatch(d){
    diff.current=d; setDiffS(d);
    you.current={side:"you",x:W/2,y:H-56,hp:NEST_HP,maxHp:NEST_HP,food:45};
    const dc=DIFF[d];
    ai.current={side:"ai",x:W/2,y:56,hp:NEST_HP,maxHp:NEST_HP,food:45+dc.eco*15};
    ants.current=[]; foods.current=freshFoods(); parts.current=[]; floats.current=[];
    idc.current=idc.current;
    upg.current={you:{gather:0,combat:0},ai:{gather:0,combat:0}};
    spawnCd.current={you:{worker:0,soldier:0,scout:0},ai:{worker:0,soldier:0,scout:0}};
    aiBrain.current={mode:"eco",ecoT:0}; foodRegen.current=0; timeS.current=0;
    rally.current="defend"; setRallyS("defend"); setUpgS({gather:0,combat:0});
    // 시작 일개미 3마리씩
    for(let i=0;i<3;i++){ spawnAnt("you","worker"); spawnAnt("ai","worker"); }
    phase.current="play"; setPhaseS("play"); setResult(null); clearMatch(); setHasSave(false); syncUi();
  }
  function resumeMatch(){
    const s=savedMatch.current; if(!s)return;
    diff.current=s.diff; setDiffS(s.diff);
    you.current=s.you; ai.current=s.ai; ants.current=s.ants; foods.current=s.foods;
    parts.current=[]; floats.current=[];
    upg.current=s.upg; spawnCd.current=s.spawnCd||{you:{worker:0,soldier:0,scout:0},ai:{worker:0,soldier:0,scout:0}};
    aiBrain.current=s.aiBrain||{mode:"eco",ecoT:0}; timeS.current=s.time||0; foodRegen.current=0;
    rally.current=s.rally||"defend"; setRallyS(rally.current); setUpgS(s.upg.you);
    idc.current=(Math.max(0,...s.ants.map(a=>a.id),...s.foods.map(f=>f.id))||0)+1;
    phase.current="play"; setPhaseS("play"); setResult(null); say("💾 이어하기!"); syncUi();
  }
  function doSave(){
    if(phase.current!=="play")return;
    try{ localStorage.setItem(SAVE_KEY, JSON.stringify({
      diff:diff.current, you:you.current, ai:ai.current, ants:ants.current, foods:foods.current,
      upg:upg.current, spawnCd:spawnCd.current, aiBrain:aiBrain.current, rally:rally.current, time:timeS.current
    })); }catch(e){}
  }

  /* ---------- 이펙트 ---------- */
  function burst(x,y,color,n,pow){ for(let i=0;i<n;i++){const a=Math.random()*7,s=rand(.3,1)*(pow||60);
    parts.current.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:0,max:rand(.2,.45),size:rand(1.5,3.5),color});} }
  function floatTxt(x,y,val,color){ floats.current.push({x,y,vy:-40,life:0,max:.7,val,color:color||"#f8fafc"}); }
  function shakeIt(t,m){ if(m>=shake.current.mag||shake.current.t<=0)shake.current={t,mag:m}; }

  /* ---------- 개미 생성 ---------- */
  function spawnAnt(side,type){
    const nest=side==="you"?you.current:ai.current; const st=ANT[type];
    const combatUp=upg.current[side].combat;
    const a={id:idc.current++,side,type,
      x:nest.x+rand(-18,18), y:nest.y+(side==="you"?-16:16)+rand(-6,6),
      hp:st.hp*(1+combatUp*0.2), maxHp:st.hp*(1+combatUp*0.2),
      atk:st.atk*(1+combatUp*0.25), sp:st.sp, ang:side==="you"?-1.57:1.57,
      state:type==="worker"?"toFood":"combat", tFood:0, carry:0, cd:0};
    ants.current.push(a);
    return a;
  }
  function tryProduce(side,type){
    const nest=side==="you"?you.current:ai.current; const st=ANT[type];
    if(spawnCd.current[side][type]>0)return false;
    if(nest.food<st.cost)return false;
    // 인구 상한
    const cnt=ants.current.filter(a=>a.side===side).length;
    if(cnt>=64)return false;
    nest.food-=st.cost; spawnCd.current[side][type]=st.cd; spawnAnt(side,type);
    const n=side==="you"?you.current:ai.current; burst(n.x,n.y,side==="you"?YOU:AI,6,60);
    return true;
  }

  /* ---------- 근처 적 탐색 ---------- */
  function nearestEnemy(a,maxD,workerFirst){
    let best=null,bd=maxD*maxD, bw=null,bwd=maxD*maxD;
    for(const o of ants.current){ if(o.side===a.side||o.dead)continue;
      const dd=(o.x-a.x)**2+(o.y-a.y)**2;
      if(dd<bd){bd=dd;best=o;}
      if(workerFirst&&o.type==="worker"&&dd<bwd){bwd=dd;bw=o;}
    }
    return (workerFirst&&bw)?bw:best;
  }

  /* ---------- 스텝 ---------- */
  function step(dt){
    if(phase.current!=="play")return;
    const y=you.current,a=ai.current;
    timeS.current+=dt;
    for(const s of ["you","ai"])for(const t of ["worker","soldier","scout"])
      if(spawnCd.current[s][t]>0)spawnCd.current[s][t]-=dt;

    /* 먹이 재생성 */
    foodRegen.current-=dt;
    const aliveFood=foods.current.filter(f=>f.amt>0.5).length;
    if(aliveFood<6 && foodRegen.current<=0){ foodRegen.current=3.5;
      foods.current.push({id:idc.current++,x:rand(120,W-120),y:rand(180,H-180),amt:rand(90,150),max:150}); }
    foods.current=foods.current.filter(f=>f.amt>0.5);

    /* AI 두뇌 */
    aiBrain.current.ecoT-=dt;
    const dc=DIFF[diff.current];
    if(aiBrain.current.ecoT<=0){ aiBrain.current.ecoT=dc.ecoCd;
      const mine=ants.current.filter(x=>x.side==="ai");
      const wk=mine.filter(x=>x.type==="worker").length;
      const sd=mine.filter(x=>x.type==="soldier").length;
      const sc=mine.filter(x=>x.type==="scout").length;
      if(wk<dc.wTarget) tryProduce("ai","worker");
      else if(sc<3 && Math.random()<0.4) tryProduce("ai","scout");
      else tryProduce("ai","soldier");
      // 업그레이드
      if(a.food>90 && upg.current.ai.combat<3 && Math.random()<0.3){ a.food-=70; upg.current.ai.combat++; }
      // 공격 전환
      aiBrain.current.mode = sd>=dc.push ? "attack" : (y._pushSeen&&sd<3?"defend":aiBrain.current.mode);
      if(sd>=dc.push)aiBrain.current.mode="attack"; else if(sd<Math.max(2,dc.push-6))aiBrain.current.mode="eco";
    }

    /* 개미 업데이트 */
    for(const an of ants.current){ if(an.dead)continue;
      an.cd-=dt;
      const nest=an.side==="you"?y:a;
      const enemyNest=an.side==="you"?a:y;
      const st=ANT[an.type];
      const gatherUp=upg.current[an.side].gather;

      if(an.type==="worker"){
        /* 채집 */
        if(an.carry){ // 둥지로
          const d=dist(an.x,an.y,nest.x,nest.y); an.ang=Math.atan2(nest.y-an.y,nest.x-an.x);
          if(d<22){ nest.food+=st.gather*(1+gatherUp*0.35); an.carry=0; an.state="toFood";
            burst(nest.x,nest.y,"#84cc16",3,40); }
          else moveTo(an,nest.x,nest.y,dt);
        } else {
          let f=foods.current.find(x=>x.id===an.tFood&&x.amt>0.5);
          if(!f){ // 가장 가까운 먹이
            let bd=1e12; for(const ff of foods.current){ if(ff.amt<=0.5)continue;
              const dd=(ff.x-an.x)**2+(ff.y-an.y)**2; if(dd<bd){bd=dd;f=ff;} }
            an.tFood=f?f.id:0;
          }
          if(f){ const d=dist(an.x,an.y,f.x,f.y); an.ang=Math.atan2(f.y-an.y,f.x-an.x);
            if(d<14){ f.amt-=st.gather; an.carry=1; an.state="toNest"; }
            else moveTo(an,f.x,f.y,dt);
          } else { // 먹이 없음 → 둥지 근처 배회
            if(dist(an.x,an.y,nest.x,nest.y)>60)moveTo(an,nest.x,nest.y,dt);
            else { an.x+=rand(-8,8)*dt; an.y+=rand(-8,8)*dt; }
          }
        }
        /* 워커도 인접 적 살짝 물기 */
        const e=nearestEnemy(an,18);
        if(e&&an.cd<=0){ hitAnt(e,an.atk); an.cd=0.9; }
      } else {
        /* 전투 유닛 */
        const e=nearestEnemy(an, st.vis, an.type==="scout");
        const aggressive = an.side==="you" ? (rally.current==="attack") : (aiBrain.current.mode==="attack");
        if(e){ const d=dist(an.x,an.y,e.x,e.y); an.ang=Math.atan2(e.y-an.y,e.x-an.x);
          if(d<15){ if(an.cd<=0){ hitAnt(e,an.atk*DIFF[diff.current].atkMul*(an.side==="ai"?1:1)); an.cd=st.cd*0.5;
            burst((an.x+e.x)/2,(an.y+e.y)/2,"#fca5a5",3,50); } }
          else moveTo(an,e.x,e.y,dt);
        } else if(aggressive){ // 적 둥지로 진격
          const d=dist(an.x,an.y,enemyNest.x,enemyNest.y); an.ang=Math.atan2(enemyNest.y-an.y,enemyNest.x-an.x);
          if(d<38){ if(an.cd<=0){ enemyNest.hp-=an.atk*1.4*DIFF[diff.current].atkMul; an.cd=st.cd;
            burst(enemyNest.x+rand(-16,16),enemyNest.y+rand(-10,10),an.side==="you"?YOU:AI,3,50);
            if(an.side==="ai")shakeIt(.12,3); } }
          else moveTo(an,enemyNest.x,enemyNest.y,dt);
        } else { // 방어: 둥지 주변 순찰
          const guardY=nest.y+(an.side==="you"?-70:70);
          const gx=nest.x+Math.sin(timeS.current*0.6+an.id)*90;
          if(dist(an.x,an.y,gx,guardY)>16)moveTo(an,gx,guardY,dt);
        }
      }
    }
    ants.current=ants.current.filter(an=>{ if(an.dead){ burst(an.x,an.y,an.side==="you"?YOU_D:AI_D,5,55); return false; } return true; });

    /* 파티클/텍스트 */
    for(const p of parts.current){ p.life+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=0.92; p.vy*=0.92; }
    parts.current=parts.current.filter(p=>p.life<p.max);
    if(parts.current.length>360)parts.current.splice(0,parts.current.length-360);
    for(const f of floats.current){ f.life+=dt; f.y+=f.vy*dt; }
    floats.current=floats.current.filter(f=>f.life<f.max);
    if(shake.current.t>0)shake.current.t-=dt;

    /* 승패 */
    if(y.hp<=0||a.hp<=0){ endMatch(a.hp<=0&&y.hp>0); }

    /* 자동 저장(2초) */
    saveAcc.current+=dt; if(saveAcc.current>=2){ saveAcc.current=0; doSave(); }
    acc.current+=dt; if(acc.current>=0.12){ acc.current=0; syncUi(); }
  }
  function moveTo(an,tx,ty,dt){ const d=dist(an.x,an.y,tx,ty)||1;
    an.x+=(tx-an.x)/d*an.sp*dt; an.y+=(ty-an.y)/d*an.sp*dt; }
  function hitAnt(o,dmg){ o.hp-=dmg; if(o.hp<=0)o.dead=true; }

  function endMatch(won){
    phase.current="over"; setPhaseS("over"); clearMatch(); setHasSave(false);
    const r={...record.current}; if(won)r.w++; else r.l++;
    record.current=r; saveRecord(r); setRec(r);
    setResult({won, time:Math.floor(timeS.current), diff:diff.current});
  }

  /* ---------- 렌더 ---------- */
  function draw(now){
    const cv=cvRef.current; if(!cv)return; const ctx=cv.getContext("2d");
    const DPR=cv._dpr||1; ctx.setTransform(DPR,0,0,DPR,0,0);
    let sx=0,sy=0; if(shake.current.t>0){const m=shake.current.mag*(shake.current.t/.3);sx=rand(-m,m);sy=rand(-m,m);}
    // 흙 배경
    const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,"#3a2c1c"); g.addColorStop(.5,"#2a2012"); g.addColorStop(1,"#3a2c1c");
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    // 셋업/미시작 단계: 둥지가 아직 없으면 배경만 그리고 반환 (null 참조로 루프 죽는 것 방지)
    if(!you.current||!ai.current)return;
    ctx.save(); ctx.translate(sx,sy);
    // 흙 얼룩
    ctx.globalAlpha=.5;
    for(let i=0;i<40;i++){ const x=(i*137.5)%W, yy=((i*89.3)%H); ctx.fillStyle=i%2?"#33261700":"#4a3a2233";
      ctx.beginPath(); ctx.arc(x,yy,rand(6,16),0,7); ctx.fill(); }
    ctx.globalAlpha=1;
    // 먹이(잎)
    for(const f of foods.current){ const s=0.5+0.5*(f.amt/f.max);
      ctx.save(); ctx.translate(f.x,f.y);
      ctx.fillStyle="#3f6212"; ctx.beginPath(); ctx.ellipse(0,4,16*s,6*s,0,0,7); ctx.fill();
      for(let k=0;k<3;k++){ ctx.save(); ctx.rotate(k*2.1); ctx.fillStyle=k%2?"#65a30d":"#4d7c0f";
        ctx.beginPath(); ctx.ellipse(0,-6*s,7*s,12*s,0,0,7); ctx.fill();
        ctx.strokeStyle="#365314"; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(0,-16*s); ctx.lineTo(0,2*s); ctx.stroke(); ctx.restore(); }
      ctx.restore();
      // 잔량바
      ctx.fillStyle="rgba(0,0,0,.4)"; ctx.fillRect(f.x-12,f.y-24,24,3);
      ctx.fillStyle="#a3e635"; ctx.fillRect(f.x-12,f.y-24,24*(f.amt/f.max),3);
    }
    // 둥지
    drawNest(ctx,you.current,YOU,YOU_D,"내 개미굴");
    drawNest(ctx,ai.current,AI,AI_D,"적 개미굴");
    // 개미 (깊이 정렬 대충 y순)
    const sorted=ants.current.slice().sort((p,q)=>p.y-q.y);
    for(const an of sorted)drawAnt(ctx,an);
    // 파티클
    for(const p of parts.current){ const al=1-p.life/p.max; ctx.globalAlpha=al; ctx.fillStyle=p.color;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.size*al+0.5,0,7); ctx.fill(); }
    ctx.globalAlpha=1;
    // 텍스트
    for(const f of floats.current){ const al=1-f.life/f.max; ctx.globalAlpha=al;
      ctx.font="bold 12px ui-monospace,monospace"; ctx.textAlign="center"; ctx.lineWidth=3; ctx.strokeStyle="rgba(0,0,0,.6)";
      ctx.fillStyle=f.color; ctx.strokeText(f.val,f.x,f.y); ctx.fillText(f.val,f.x,f.y); }
    ctx.globalAlpha=1;
    ctx.restore();
  }
  function drawNest(ctx,n,col,cold,label){
    ctx.save(); ctx.translate(n.x,n.y);
    // 흙더미
    const grd=ctx.createRadialGradient(0,-4,4,0,0,40); grd.addColorStop(0,cold); grd.addColorStop(1,"#241a10");
    ctx.fillStyle=grd; ctx.beginPath(); ctx.ellipse(0,0,42,26,0,0,7); ctx.fill();
    ctx.fillStyle="#1a1208"; ctx.beginPath(); ctx.ellipse(0,-2,12,7,0,0,7); ctx.fill(); // 입구
    ctx.strokeStyle=col; ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(0,-2,12,7,0,0,7); ctx.stroke();
    ctx.restore();
    // HP바
    const w=80, r=Math.max(0,n.hp/n.maxHp);
    ctx.fillStyle="rgba(0,0,0,.55)"; ctx.fillRect(n.x-w/2,n.y-42,w,6);
    ctx.fillStyle=r>.5?col:r>.25?"#eab308":"#ef4444"; ctx.fillRect(n.x-w/2,n.y-42,w*r,6);
    ctx.font="bold 10px sans-serif"; ctx.textAlign="center"; ctx.fillStyle="#fff";
    ctx.fillText(label+" "+Math.ceil(n.hp),n.x,n.y-46);
  }
  function drawAnt(ctx,an){
    const col=an.side==="you"?YOU:AI, cold=an.side==="you"?YOU_D:AI_D;
    const sc=an.type==="soldier"?1.35:an.type==="scout"?0.9:1;
    ctx.save(); ctx.translate(an.x,an.y); ctx.rotate(an.ang);
    // 다리
    ctx.strokeStyle=cold; ctx.lineWidth=1;
    for(let i=-1;i<=1;i++){ ctx.beginPath(); ctx.moveTo(i*3*sc,0); ctx.lineTo(i*3*sc-4*sc,-5*sc); ctx.moveTo(i*3*sc,0); ctx.lineTo(i*3*sc-4*sc,5*sc); ctx.stroke(); }
    // 몸통 3마디
    ctx.fillStyle=col;
    ctx.beginPath(); ctx.ellipse(-5*sc,0,4*sc,3.4*sc,0,0,7); ctx.fill();   // 배
    ctx.fillStyle=cold; ctx.beginPath(); ctx.ellipse(0,0,3*sc,2.6*sc,0,0,7); ctx.fill(); // 가슴
    ctx.fillStyle=col; ctx.beginPath(); ctx.arc(5*sc,0,3*sc,0,7); ctx.fill(); // 머리
    // 더듬이/큰턱 (병정)
    ctx.strokeStyle=cold; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(7*sc,-2*sc); ctx.lineTo(11*sc,-4*sc); ctx.moveTo(7*sc,2*sc); ctx.lineTo(11*sc,4*sc); ctx.stroke();
    if(an.type==="soldier"){ ctx.lineWidth=2; ctx.strokeStyle="#f8fafc";
      ctx.beginPath(); ctx.moveTo(8*sc,-2*sc); ctx.lineTo(13*sc,-3*sc); ctx.moveTo(8*sc,2*sc); ctx.lineTo(13*sc,3*sc); ctx.stroke(); }
    // 짐(잎)
    if(an.carry){ ctx.rotate(-an.ang); ctx.fillStyle="#65a30d"; ctx.beginPath(); ctx.ellipse(0,-6*sc,4,6,0,0,7); ctx.fill(); ctx.rotate(an.ang); }
    ctx.restore();
    // 체력바 (피해 입은 전투유닛)
    if(an.type!=="worker" && an.hp<an.maxHp){ const w=12*sc,r=an.hp/an.maxHp;
      ctx.fillStyle="rgba(0,0,0,.5)"; ctx.fillRect(an.x-w/2,an.y-10*sc,w,2);
      ctx.fillStyle=r>.4?"#84cc16":"#ef4444"; ctx.fillRect(an.x-w/2,an.y-10*sc,w*r,2); }
  }

  /* ---------- 루프/입력 ---------- */
  useEffect(()=>{
    const cv=cvRef.current; const DPR=Math.min(2,window.devicePixelRatio||1);
    cv.width=W*DPR;cv.height=H*DPR;cv.style.width=W+"px";cv.style.height=H+"px";cv._dpr=DPR;
    let raf,last=performance.now(),accum=0;const STEP=1/60;
    const loop=(now)=>{ let dt=(now-last)/1000;last=now;if(dt>0.4)dt=0.4;accum+=dt;let g=0;
      try{ while(accum>=STEP&&g++<30){ step(STEP); accum-=STEP; }
        if(accum>=STEP)accum=0; draw(now); }catch(err){ console.error("ant loop error",err); }
      raf=requestAnimationFrame(loop); };
    raf=requestAnimationFrame(loop);
    return ()=>cancelAnimationFrame(raf);
  },[]);

  function setRally(r){ rally.current=r; setRallyS(r); }
  function buyUpg(kind){ const y=you.current; if(phase.current!=="play")return;
    const cost=kind==="gather"?60:75;
    if(y.food<cost){ say("💰 먹이가 부족해요!"); return; }
    if(upg.current.you[kind]>=3){ say("최대 레벨!"); return; }
    y.food-=cost; upg.current.you[kind]++; setUpgS({...upg.current.you}); syncUi();
    say(kind==="gather"?"🍃 채집력 강화!":"⚔️ 병력 강화!"); }
  function produce(type){ if(phase.current!=="play")return; if(!tryProduce("you",type))say("먹이 부족 또는 대기 중"); else syncUi(); }
  function quit(){ doSave(); savedMatch.current=loadMatch(); setHasSave(!!savedMatch.current);
    phase.current="setup"; setPhaseS("setup"); say("💾 저장하고 나왔어요"); }

  const bothHp=(ui.yhp+0.001);
  return (
    <div className="min-h-screen w-full flex flex-col items-center p-3 text-amber-50"
      style={{background:"radial-gradient(900px 400px at 50% -10%, #4a2c0d55, transparent), #0f0d0a"}}>
      {/* HUD */}
      <div className="glass rounded-2xl px-4 py-2 mb-2 flex items-center gap-3 flex-wrap shadow-xl" style={{width:W}}>
        <div className="font-black text-lg bg-gradient-to-r from-amber-300 to-lime-400 bg-clip-text text-transparent">🐜 개미굴 대전</div>
        {phaseS==="play"&&<>
          <span className="text-sm font-bold text-lime-300">🍃 {ui.food}</span>
          <span className="text-sm font-bold text-amber-200">🐜{ui.wk} ⚔️{ui.sd} 🦗{ui.sc}</span>
          <div className="flex-1"></div>
          <span className="text-xs font-bold" style={{color:YOU}}>내 굴 {ui.yhp}</span>
          <span className="text-xs font-bold" style={{color:AI}}>적 굴 {ui.ahp}</span>
          <span className="text-xs font-bold text-slate-300">⏱ {Math.floor(ui.time/60)}:{String(ui.time%60).padStart(2,"0")}</span>
        </>}
        {phaseS!=="play"&&<>
          <div className="flex-1"></div>
          <span className="text-sm font-bold text-yellow-300">🏆 {rec.w}승 {rec.l}패</span>
        </>}
      </div>

      <div className="relative">
        <canvas ref={cvRef} className="shadow-2xl" style={{border:"1px solid rgba(255,255,255,.08)"}}/>
        {/* 셋업(대결 상대 선택) */}
        {phaseS==="setup"&&(
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-xl">
            <div className="text-center pop max-w-md px-6">
              <div className="text-5xl mb-2">🐜⚔️🐜</div>
              <div className="text-2xl font-black text-amber-300 mb-1">개미굴 vs 개미굴</div>
              <div className="text-xs text-amber-100/70 mb-4 leading-relaxed">
                일개미로 잎을 모으고, 병정·정찰 개미를 길러 적의 개미굴을 무너뜨리세요!<br/>
                <b className="text-lime-300">🍃 채집 → 개미 생산 → 총공격</b></div>
              {hasSave&&(
                <button onClick={resumeMatch} className="btng w-full py-2.5 rounded-xl font-black text-slate-900 bg-gradient-to-r from-lime-300 to-emerald-400 shadow-lg mb-3">
                  💾 이어하기 (저장된 대결)</button>)}
              <div className="text-xs font-bold text-amber-100/60 mb-2">대결 상대 (AI 난이도)</div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {Object.entries(DIFF).map(([k,v])=>(
                  <button key={k} onClick={()=>newMatch(k)}
                    className="btng rounded-xl py-3 font-black border-2"
                    style={{borderColor:v.color,background:v.color+"22",color:v.color}}>{v.name}</button>))}
              </div>
              <div className="text-xs text-amber-100/50">🏆 전적: {rec.w}승 {rec.l}패</div>
            </div>
          </div>)}
      </div>

      {/* 컨트롤 */}
      {phaseS==="play"&&(
        <div className="glass rounded-2xl px-3 py-2 mt-2 shadow-xl" style={{width:W}}>
          <div className="flex items-center gap-2 flex-wrap">
            {["worker","soldier","scout"].map(t=>{ const st=ANT[t]; const cd=cds[t]||0; const can=ui.food>=st.cost&&cd<=0;
              return (
                <button key={t} onClick={()=>produce(t)}
                  className="btng rounded-xl px-3 py-1.5 flex items-center gap-2 border-2 relative overflow-hidden"
                  style={{borderColor:"rgba(255,255,255,.12)",background:"rgba(40,32,20,.6)",opacity:can?1:.55}}>
                  {cd>0&&<div className="absolute inset-0 bg-black/50" style={{clipPath:"inset("+(100-cd/st.cd*100)+"% 0 0 0)"}}></div>}
                  <span className="text-xl">{st.icon}</span>
                  <span className="text-left leading-tight relative"><div className="text-[11px] font-bold">{st.name}</div>
                    <div className="text-[10px] text-lime-300">🍃{st.cost}</div></span>
                </button>); })}
            <div className="w-px h-8 bg-white/10 mx-1"></div>
            <button onClick={()=>buyUpg("gather")} className="btng rounded-xl px-2.5 py-1.5 border-2 text-center"
              style={{borderColor:"#84cc1655",background:"rgba(40,50,20,.5)"}}>
              <div className="text-lg">🍃</div><div className="text-[9px] font-bold text-lime-300">채집 Lv{upgS.gather} (60)</div></button>
            <button onClick={()=>buyUpg("combat")} className="btng rounded-xl px-2.5 py-1.5 border-2 text-center"
              style={{borderColor:"#f8717155",background:"rgba(50,25,25,.5)"}}>
              <div className="text-lg">⚔️</div><div className="text-[9px] font-bold text-red-300">병력 Lv{upgS.combat} (75)</div></button>
            <div className="w-px h-8 bg-white/10 mx-1"></div>
            <button onClick={()=>setRally(rallyS==="attack"?"defend":"attack")}
              className={"btng rounded-xl px-4 py-2 font-black border-2 "+(rallyS==="attack"?"animate-pulse":"")}
              style={{borderColor:rallyS==="attack"?"#ef4444":"#38bdf8",background:rallyS==="attack"?"#ef444433":"#38bdf822",color:rallyS==="attack"?"#fca5a5":"#7dd3fc"}}>
              {rallyS==="attack"?"⚔️ 총공격 중":"🛡️ 방어 중"}</button>
            <div className="flex-1"></div>
            <button onClick={quit} className="btng rounded-xl px-3 py-2 font-bold text-xs glass">💾 저장·나가기</button>
          </div>
          <div className="text-[10px] text-amber-100/50 mt-1">
            {rallyS==="attack"?"⚔️ 병정·정찰 개미가 적 개미굴로 진격합니다":"🛡️ 병정 개미가 내 굴을 지킵니다. 병력을 모아 총공격하세요!"}
          </div>
        </div>)}

      {/* 결과 */}
      {result&&(
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="glass rounded-2xl p-8 text-center pop max-w-sm w-full" style={{borderColor:result.won?"#84cc1688":"#ef444488"}}>
            <div className="text-6xl mb-2">{result.won?"🏆🐜":"💀🐜"}</div>
            <div className={"text-2xl font-black mb-3 "+(result.won?"text-lime-300":"text-red-400")}>
              {result.won?"승리! 적 개미굴 파괴!":"패배... 개미굴이 무너졌다"}</div>
            <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
              <div className="rounded-xl bg-white/5 p-2"><div className="text-amber-100/60 text-[11px]">난이도</div><div className="text-lg font-black" style={{color:DIFF[result.diff].color}}>{DIFF[result.diff].name}</div></div>
              <div className="rounded-xl bg-white/5 p-2"><div className="text-amber-100/60 text-[11px]">소요 시간</div><div className="text-lg font-black text-sky-300">{Math.floor(result.time/60)}:{String(result.time%60).padStart(2,"0")}</div></div>
            </div>
            <div className="text-xs text-amber-100/60 mb-4">🏆 전적: <b className="text-yellow-300">{rec.w}승 {rec.l}패</b></div>
            <button onClick={()=>{setResult(null);phase.current="setup";setPhaseS("setup");}}
              className="btng w-full py-3 rounded-xl font-black text-slate-900 bg-gradient-to-r from-amber-300 to-lime-400 shadow-lg">🔄 다시 대결</button>
          </div>
        </div>)}

      {toast&&<div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl glass font-bold shadow-2xl fadein">{toast}</div>}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Game/>);
</script>
</body>
</html>'''


def ant_war_page():
    st.title("🐜 개미굴 vs 개미굴 대전")
    st.caption("실시간 전략! 일개미로 잎을 모으고 병정·정찰 개미를 길러 적 개미굴을 파괴하세요. 난이도별 AI 대결 · 자동 저장/이어하기 · 전적 기록")
    components.html(ANT_WAR_HTML, height=820, scrolling=True)


# ==========================================
# 7-7. ⚔️ 검투사 아레나 (React 임베드)
# ==========================================
GLADIATOR_HTML = r'''<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<script src="https://cdn.tailwindcss.com"></script>
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script>
  Babel.registerPreset('classic-react', { presets: [[Babel.availablePresets['react'], { runtime: 'classic' }]] });
</script>
<style>
  html,body{margin:0;padding:0;background:#0a0a0f;overflow-x:hidden;font-family:ui-sans-serif,system-ui,'Segoe UI',sans-serif;}
  #root{min-height:100vh;}
  .glass{background:rgba(22,18,28,.66);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.09);}
  canvas{display:block;border-radius:12px;image-rendering:auto;}
  .btng{transition:transform .1s, filter .1s;}
  .btng:hover{transform:translateY(-2px);filter:brightness(1.12);}
  .btng:active{transform:translateY(1px);}
  .pop{animation:pop .3s cubic-bezier(.2,1.5,.4,1);}
  @keyframes pop{from{transform:scale(.7);opacity:0}to{transform:scale(1);opacity:1}}
  .fadein{animation:fadein .35s ease;}
  @keyframes fadein{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  kbd{background:#2a2338;border:1px solid #4b4066;border-bottom-width:2px;border-radius:5px;padding:1px 7px;font-size:12px;font-weight:700;color:#e9d8ff;}
  ::-webkit-scrollbar{height:7px;width:7px}::-webkit-scrollbar-thumb{background:#4b3a63;border-radius:8px}
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel" data-presets="classic-react">
const { useState, useRef, useEffect } = React;

/* ===================== 상수 ===================== */
const W=820, H=460, FLOOR=372;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const rand=(a,b)=>a+Math.random()*(b-a);
const BEST_KEY="ynd_glad_best_v1";
const loadBest=()=>{ try{ return parseInt(localStorage.getItem(BEST_KEY))||0; }catch(e){ return 0; } };
const saveBest=(v)=>{ try{ localStorage.setItem(BEST_KEY,String(v)); }catch(e){} };

// 공격 정의: 윈드업 → 액티브(피격 판정) → 리커버
const ATK={
  light:{ wind:0.15, act:0.08, rec:0.20, dmg:9,  range:70, cost:8,  push:70,  label:"L" },
  heavy:{ wind:0.40, act:0.10, rec:0.40, dmg:20, range:82, cost:20, push:150, label:"H" },
};
const PARRY_WIN=0.20;      // 막기 시작 후 이 시간 안에 맞으면 패링
const DODGE_DUR=0.42, DODGE_IFRAME=[0.05,0.30], DODGE_COST=22, DODGE_SPEED=340;
const MOVE_SPEED=150, MIN_SEP=64, STAM_REGEN=26;
const HITSTOP_MAX=0.09;

const DIFF={
  easy:  {name:"쉬움",   react:0.55, aggro:0.62, atkCd:[0.55,0.95], parryChance:0.12, dodgeChance:0.16, color:"#22c55e"},
  normal:{name:"보통",   react:0.32, aggro:0.80, atkCd:[0.40,0.75], parryChance:0.28, dodgeChance:0.24, color:"#eab308"},
  hard:  {name:"어려움", react:0.17, aggro:0.95, atkCd:[0.28,0.55], parryChance:0.46, dodgeChance:0.34, color:"#ef4444"},
};

// 콤보 시퀀스 → 특수기 (뒤에서부터 매칭)
const COMBOS=[
  {seq:"LLH", name:"어퍼컷!",   dmgMul:1.6, launch:true,  stun:0.6 },
  {seq:"HH",  name:"강타 연계!", dmgMul:1.4, gbreak:true,  stun:0.0 },
  {seq:"LHL", name:"회전베기!", dmgMul:1.5, push:1.6,     stun:0.2 },
  {seq:"LLL", name:"난무!",     dmgMul:1.3, stamBack:16,  stun:0.0 },
];

/* ===================== 파이터 ===================== */
function mkFighter(side){
  return {
    side, x: side==="p"?270:550, y:FLOOR, facing: side==="p"?1:-1,
    hp:100, maxHp:100, stam:100, maxStam:100,
    state:"idle", t:0,               // idle|walk|attack|block|dodge|stun|hurt
    atk:null,                        // {type,phase,timer,dur,hitDone}
    guardT:0, guarding:false,        // guarding: 실제 막기 유지 중
    combo:0, comboT:0, seq:"", special:"", specialT:0,
    counter:false,                   // 패링 성공 후 다음 공격 강화
    stunT:0, iframe:0, hitFlash:0, flashCol:"#fff",
    vx:0, lungeVX:0, msg:"", msgT:0, blink:0,
  };
}

/* ===================== 게임 컴포넌트 ===================== */
function Game(){
  const cvRef=useRef(null);
  const p=useRef(null), e=useRef(null);
  const parts=useRef([]), floats=useRef([]), sparks=useRef([]);
  const keys=useRef({}), buf=useRef({light:false,heavy:false,dodge:false});
  const phase=useRef("menu");        // menu|fight|roundover|matchover
  const diff=useRef("normal");
  const round=useRef(1), scoreP=useRef(0), scoreE=useRef(0);
  const shake=useRef({t:0,mag:0}), hitstop=useRef(0), roundBanner=useRef({t:0,txt:""});
  const aiRef=useRef({cd:0, react:0, plan:"approach"});
  const [ui,setUi]=useState({phase:"menu",diff:"normal",round:1,sp:0,se:0,best:loadBest(),result:""});

  const sync=()=>setUi({phase:phase.current,diff:diff.current,round:round.current,sp:scoreP.current,se:scoreE.current,best:loadBest(),result:resultTxt.current});
  const resultTxt=useRef("");

  /* ---------- 이펙트 ---------- */
  const addParts=(x,y,col,n,spd)=>{ for(let i=0;i<n;i++){ const a=rand(0,Math.PI*2),s=rand(spd*0.3,spd); parts.current.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-rand(20,90),life:rand(.3,.6),t:0,col,r:rand(2,4)});} };
  const addSpark=(x,y)=>{ for(let i=0;i<14;i++){ const a=rand(0,Math.PI*2),s=rand(120,320); sparks.current.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(.18,.34),t:0}); } };
  const addFloat=(x,y,txt,col,big)=>floats.current.push({x,y,txt,col,life:0.9,t:0,big:!!big});
  const doShake=(m)=>{ shake.current.t=0.22; shake.current.mag=m; };
  const doStop=(s)=>{ hitstop.current=Math.min(HITSTOP_MAX,Math.max(hitstop.current,s)); };

  /* ---------- 라운드/매치 ---------- */
  const resetFighters=()=>{ p.current=mkFighter("p"); e.current=mkFighter("e"); parts.current=[]; floats.current=[]; sparks.current=[]; buf.current={light:false,heavy:false,dodge:false}; };
  const startMatch=(d)=>{ diff.current=d; round.current=1; scoreP.current=0; scoreE.current=0; resetFighters(); aiRef.current={cd:rand(0.5,1),react:0,plan:"approach"}; phase.current="fight"; roundBanner.current={t:1.3,txt:"라운드 1"}; resultTxt.current=""; sync(); };
  const nextRound=()=>{ round.current++; resetFighters(); aiRef.current={cd:rand(0.5,1),react:0,plan:"approach"}; phase.current="fight"; roundBanner.current={t:1.3,txt:"라운드 "+round.current}; sync(); };

  const endRound=(pWon)=>{
    if(phase.current!=="fight")return;
    if(pWon)scoreP.current++; else scoreE.current++;
    roundBanner.current={t:1.4,txt:pWon?"승리!":"패배..."};
    if(scoreP.current>=2||scoreE.current>=2){
      const win=scoreP.current>=2;
      resultTxt.current= win? "매치 승리! 🏆":"매치 패배 😵";
      // 최고 연승 기록: 매치 승리 시 누적, 패배 시 0으로 리셋
      if(win){ saveBest(loadBest()+1); } else { saveBest(0); }
      phase.current="matchover";
    } else {
      phase.current="roundover";
    }
    sync();
  };

  /* ---------- 공격 시작 ---------- */
  const canAct=(f)=> (f.state==="idle"||f.state==="walk"||f.state==="block") && f.stunT<=0;
  const startAttack=(f,type)=>{
    const a=ATK[type];
    if(f.stam<a.cost){ f.msg="기력 부족"; f.msgT=0.5; return false; }
    f.stam-=a.cost; f.state="attack"; f.guarding=false;
    f.atk={type,phase:"wind",timer:0,dur:a.wind,hitDone:false};
    // 살짝 전진 러시
    f.lungeVX=f.facing*(type==="heavy"?120:80);
    return true;
  };
  const startBlock=(f)=>{ if(!canAct(f))return; if(f.state!=="block"){ f.state="block"; f.guarding=true; f.guardT=0; } };
  const endBlock=(f)=>{ if(f.state==="block"){ f.state="idle"; f.guarding=false; } };
  const startDodge=(f,dir)=>{
    if(!canAct(f)||f.stam<DODGE_COST)return;
    f.stam-=DODGE_COST; f.state="dodge"; f.t=0; f.atk=null; f.guarding=false;
    f.lungeVX=(dir||-f.facing)*DODGE_SPEED;
  };

  /* ---------- 피격 판정 ---------- */
  const resolveHit=(atk,def)=>{
    const a=ATK[atk.atk.type];
    // 회피(무적) 판정
    if(def.state==="dodge"&&def.iframe>0){ addFloat(def.x,def.y-90,"회피","#67e8f9"); def.stam=clamp(def.stam+8,0,def.maxStam); return; }
    // 막기 판정
    if(def.state==="block"&&def.guarding){
      if(def.guardT<=PARRY_WIN){
        // 패링 성공!
        atk.state="stun"; atk.stunT=(atk.atk.type==="heavy"?1.0:0.8); atk.atk=null; atk.t=0;
        def.counter=true; def.stam=clamp(def.stam+16,0,def.maxStam);
        addFloat((atk.x+def.x)/2,def.y-96,"패링!","#fde047",true);
        addSpark((atk.x+def.x)/2,def.y-42); doShake(9); doStop(0.09);
        def.msg="반격 기회!"; def.msgT=0.9;
        return;
      } else {
        // 일반 가드: 칩 데미지 + 스태미너 소모
        const chip=a.dmg*0.18; def.hp=clamp(def.hp-chip,0,def.maxHp);
        const scost=(atk.atk.type==="heavy"?34:18);
        def.stam-=scost;
        def.x=clamp(def.x+atk.facing*18,60,W-60);
        addFloat(def.x,def.y-90,"가드","#a3a3a3");
        addSpark(def.x+atk.facing*24,def.y-42); doShake(4); doStop(0.05);
        if(def.stam<=0){ def.stam=0; def.state="stun"; def.stunT=0.75; def.guarding=false; addFloat(def.x,def.y-96,"가드 붕괴!","#f87171",true); doShake(7); }
        return;
      }
    }
    // 무방비 히트
    let mul=1;
    if(atk.counter){ mul*=1.7; atk.counter=false; addFloat(atk.x,atk.y-100,"반격!","#fca5a5"); }
    // 콤보 시퀀스 적립 & 특수기
    atk.seq=(atk.seq+a.label).slice(-4);
    let special=null;
    for(const c of COMBOS){ if(atk.seq.endsWith(c.seq)){ special=c; break; } }
    let dmg=a.dmg*mul*(1+atk.combo*0.04);
    let push=a.push, launch=false;
    if(special){
      dmg*=special.dmgMul; push*=(special.push||1);
      if(special.launch)launch=true;
      if(special.stamBack)atk.stam=clamp(atk.stam+special.stamBack,0,atk.maxStam);
      if(special.gbreak){ def.state="stun"; def.stunT=Math.max(def.stunT,0.6); }
      if(special.stun>0){ def.stunT=Math.max(def.stunT,special.stun); }
      atk.special=special.name; atk.specialT=1.1; atk.seq="";
      addFloat(atk.x,atk.y-116,special.name,"#f0abfc",true);
    }
    def.hp=clamp(def.hp-dmg,0,def.maxHp);
    def.state="hurt"; def.t=0; def.stunT=Math.max(def.stunT, launch?0.5:0.18);
    def.hitFlash=0.18; def.flashCol="#ff5a5a";
    def.lungeVX=atk.facing*push*(launch?1.2:1);
    def.x=clamp(def.x,60,W-60);
    atk.combo++; atk.comboT=1.6;
    addParts(def.x, def.y-52, "#e11d48", launch?16:10, launch?260:180);
    addFloat(def.x, def.y-100, Math.round(dmg)+"", "#fee2e2", launch);
    doShake(launch?11:7); doStop(launch?0.09:0.06);
    if(def.hp<=0){ def.hp=0; }
  };

  /* ---------- 파이터 업데이트 ---------- */
  const stepFighter=(f,o,dt,intent)=>{
    // 타이머 감소
    if(f.stunT>0)f.stunT-=dt;
    if(f.iframe>0)f.iframe-=dt;
    if(f.hitFlash>0)f.hitFlash-=dt;
    if(f.msgT>0)f.msgT-=dt;
    if(f.specialT>0)f.specialT-=dt;
    if(f.comboT>0){ f.comboT-=dt; if(f.comboT<=0){ f.combo=0; f.seq=""; f.counter=false; } }
    f.blink+=dt;

    // 항상 상대를 바라봄 (공격/피격/기절 중 제외한 안정 상태에서만 전환)
    if(f.state==="idle"||f.state==="walk"||f.state==="block"){ f.facing = o.x>=f.x?1:-1; }

    // 기절 처리
    if(f.state==="stun"){ if(f.stunT<=0){ f.state="idle"; } }
    // 피격 경직
    if(f.state==="hurt"){ f.t+=dt; if(f.t>=0.22&&f.stunT<=0){ f.state="idle"; } }

    // 회피(구르기)
    if(f.state==="dodge"){
      f.t+=dt;
      f.iframe = (f.t>=DODGE_IFRAME[0]&&f.t<=DODGE_IFRAME[1])? Math.max(f.iframe,0.02):f.iframe;
      f.x=clamp(f.x+f.lungeVX*dt,60,W-60);
      f.lungeVX*=Math.pow(0.02,dt);
      if(f.t>=DODGE_DUR){ f.state="idle"; f.lungeVX=0; }
    }

    // 공격 상태머신
    if(f.state==="attack"&&f.atk){
      const a=ATK[f.atk.type]; f.atk.timer+=dt;
      // 러시 전진 감쇠
      f.x=clamp(f.x+f.lungeVX*dt,60,W-60); f.lungeVX*=Math.pow(0.0009,dt);
      if(f.atk.phase==="wind"&&f.atk.timer>=a.wind){ f.atk.phase="act"; f.atk.timer=0; }
      else if(f.atk.phase==="act"){
        // 액티브 프레임: 판정
        if(!f.atk.hitDone){
          const dx=o.x-f.x;
          if(dx*f.facing>0 && Math.abs(dx)<=a.range && Math.abs(o.y-f.y)<40){
            f.atk.hitDone=true; resolveHit(f,o);
          }
        }
        if(f.atk.timer>=a.act){ f.atk.phase="rec"; f.atk.timer=0; }
      }
      else if(f.atk.phase==="rec"&&f.atk.timer>=a.rec){ f.state="idle"; f.atk=null; }
      return; // 공격 중엔 이동/막기 입력 무시
    }

    // 안정 상태: 입력 처리
    if(f.state==="idle"||f.state==="walk"||f.state==="block"){
      // 막기 유지 타이머
      if(f.state==="block"){ f.guardT+=dt; }
      // 스태미너 재생 (막기/공격 중 아닐 때)
      if(f.state!=="block"){ f.stam=clamp(f.stam+STAM_REGEN*dt,0,f.maxStam); }
      else { f.stam=clamp(f.stam+STAM_REGEN*0.25*dt,0,f.maxStam); }

      // 인텐트 적용
      if(intent){
        if(intent.dodge){ startDodge(f,intent.dodgeDir); }
        else if(intent.heavy){ startAttack(f,"heavy"); }
        else if(intent.light){ startAttack(f,"light"); }
        else if(intent.block){ startBlock(f); }
        else {
          if(f.state==="block")endBlock(f);
          // 이동
          let mv=0; if(intent.left)mv-=1; if(intent.right)mv+=1;
          if(mv!==0){
            const nx=clamp(f.x+mv*MOVE_SPEED*dt,60,W-60);
            // 상대와 겹침 방지
            if(Math.abs(nx-o.x)>=MIN_SEP || Math.abs(nx-o.x)>Math.abs(f.x-o.x)){ f.x=nx; f.state="walk"; }
            else f.state="idle";
          } else f.state="idle";
        }
      } else if(f.state!=="block"){ f.state="idle"; }
    }
  };

  /* ---------- AI 인텐트 ---------- */
  const aiIntent=(f,o,dt)=>{
    const A=aiRef.current, cfg=DIFF[diff.current];
    const intent={left:false,right:false,light:false,heavy:false,block:false,dodge:false,dodgeDir:0};
    if(!canAct(f)) return null;
    A.cd-=dt; if(A.react>0)A.react-=dt;
    const dx=o.x-f.x, adx=Math.abs(dx), dir=dx>0?1:-1;

    // 상대가 공격 윈드업/액티브 중이면 반응 (거리 안일 때)
    const oAtk = o.state==="attack" && o.atk && (o.atk.phase==="wind"||o.atk.phase==="act");
    const inThreat = adx <= ATK.heavy.range+20;
    if(oAtk && inThreat && A.react<=0){
      A.react=cfg.react;
      const r=Math.random();
      if(r<cfg.parryChance){ intent.block=true; return intent; }       // 패링 노림
      if(r<cfg.parryChance+cfg.dodgeChance){ intent.dodge=true; intent.dodgeDir=dir<0?1:-1; return intent; } // 뒤로 회피
    }
    // 가드 유지 해제 (위협 없으면 풀기 위해 아무것도 안함)

    // 거리 조절 & 공격
    if(A.cd<=0){
      if(adx>ATK.light.range-6){
        // 접근
        intent[dir>0?"right":"left"]=true;
        if(adx<=ATK.light.range+8 && Math.random()<cfg.aggro){ A.cd=rand(cfg.atkCd[0],cfg.atkCd[1]); intent.light= Math.random()<0.65; intent.heavy=!intent.light; }
      } else {
        // 근접: 공격 결정
        if(Math.random()<cfg.aggro){
          A.cd=rand(cfg.atkCd[0],cfg.atkCd[1]);
          if(f.stam<ATK.heavy.cost){ intent.light=true; }
          else intent.heavy=Math.random()<0.4, intent.light=!intent.heavy;
        } else {
          A.cd=rand(0.2,0.5);
          // 살짝 물러서기
          if(Math.random()<0.4)intent[dir>0?"left":"right"]=true;
        }
      }
    } else {
      // cd 대기 중엔 살짝 접근 유지
      if(adx>ATK.light.range+30)intent[dir>0?"right":"left"]=true;
    }
    return intent;
  };

  /* ---------- 플레이어 인텐트 ---------- */
  const playerIntent=()=>{
    const k=keys.current, b=buf.current;
    const intent={ left:!!(k["a"]||k["arrowleft"]), right:!!(k["d"]||k["arrowright"]),
      block:!!(k["l"]||k["s"]||k["arrowdown"]), light:false, heavy:false, dodge:false, dodgeDir:0 };
    if(b.dodge){ intent.dodge=true; intent.dodgeDir = intent.left?-1: intent.right?1: 0; b.dodge=false; }
    else if(b.heavy){ intent.heavy=true; b.heavy=false; }
    else if(b.light){ intent.light=true; b.light=false; }
    return intent;
  };

  /* ---------- 이펙트 스텝 ---------- */
  const stepFx=(dt)=>{
    for(const q of parts.current){ q.t+=dt; q.vy+=520*dt; q.x+=q.vx*dt; q.y+=q.vy*dt; }
    parts.current=parts.current.filter(q=>q.t<q.life);
    for(const s of sparks.current){ s.t+=dt; s.x+=s.vx*dt; s.y+=s.vy*dt; s.vx*=Math.pow(0.02,dt); s.vy*=Math.pow(0.02,dt); }
    sparks.current=sparks.current.filter(s=>s.t<s.life);
    for(const fl of floats.current){ fl.t+=dt; fl.y-=34*dt; }
    floats.current=floats.current.filter(fl=>fl.t<fl.life);
    if(shake.current.t>0)shake.current.t-=dt;
    if(roundBanner.current.t>0)roundBanner.current.t-=dt;
  };

  /* ---------- 메인 스텝 ---------- */
  const step=(dt)=>{
    if(phase.current!=="fight"){ stepFx(dt); return; }
    const P=p.current, E=e.current; if(!P||!E)return;
    const pI=playerIntent();
    const eI=aiIntent(E,P,dt);
    stepFighter(P,E,dt,pI);
    stepFighter(E,P,dt,eI);
    // 겹침 밀어내기 (양쪽 안정 상태에서만)
    const gap=Math.abs(P.x-E.x);
    if(gap<MIN_SEP-2){ const mid=(P.x+E.x)/2, half=(MIN_SEP)/2; if(P.x<=E.x){ P.x=clamp(mid-half,60,W-60); E.x=clamp(mid+half,60,W-60);} else { P.x=clamp(mid+half,60,W-60); E.x=clamp(mid-half,60,W-60);} }
    stepFx(dt);
    // 라운드 종료 판정
    if(P.hp<=0||E.hp<=0){
      if(E.hp<=0&&P.hp<=0) endRound(P.hp>=E.hp);
      else endRound(E.hp<=0);
    }
  };

  /* ---------- 그리기 ---------- */
  const drawFighter=(ctx,f,main)=>{
    const col=main? "#f59e0b":"#a855f7", dcol=main?"#b45309":"#6b21a8";
    ctx.save(); ctx.translate(f.x,f.y);
    const fc=f.facing;
    // 그림자
    ctx.fillStyle="rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(0,4,30,9,0,0,Math.PI*2); ctx.fill();
    // 회피 중 반투명
    ctx.globalAlpha = (f.state==="dodge"&&f.iframe>0)?0.45:1;
    // 히트 플래시
    const flash=f.hitFlash>0;
    const body=flash? f.flashCol: col, bodyD=flash? f.flashCol: dcol;
    // 기절 흔들림
    let lean=0;
    if(f.state==="stun") lean=Math.sin(f.blink*30)*0.12;
    if(f.state==="attack"&&f.atk){ if(f.atk.phase==="wind")lean=-fc*0.18; else if(f.atk.phase==="act")lean=fc*0.34; else lean=fc*0.1; }
    if(f.state==="hurt")lean=-fc*0.2;
    ctx.rotate(lean);
    // 다리
    ctx.strokeStyle=bodyD; ctx.lineWidth=8; ctx.lineCap="round";
    const stride=(f.state==="walk")?Math.sin(f.blink*12)*10:4;
    ctx.beginPath(); ctx.moveTo(-6,-26); ctx.lineTo(-10-stride*0.3,-2); ctx.moveTo(6,-26); ctx.lineTo(10+stride*0.3,-2); ctx.stroke();
    // 몸통
    ctx.fillStyle=body; roundRect(ctx,-16,-72,32,48,10); ctx.fill();
    ctx.fillStyle=bodyD; roundRect(ctx,-16,-72,32,14,8); ctx.fill(); // 어깨 갑옷
    // 머리 (투구)
    ctx.fillStyle=body; ctx.beginPath(); ctx.arc(0,-88,15,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=bodyD; ctx.beginPath(); ctx.arc(0,-92,15,Math.PI,Math.PI*2); ctx.fill(); // 투구 상단
    // 투구 볏
    ctx.fillStyle=main?"#fca5a5":"#f0abfc"; roundRect(ctx,-3,-108,6,16,3); ctx.fill();
    // 눈
    ctx.fillStyle="#1a1a1a"; ctx.fillRect(fc>0?2:-8,-90,6,4);
    // 방패 (막기 상태 강조)
    const shieldOut = f.state==="block";
    ctx.save(); ctx.translate(fc*(shieldOut?26:16),-52);
    ctx.fillStyle= (f.state==="block"&&f.guardT<=PARRY_WIN)? "#fde047" : "#cbd5e1";
    ctx.strokeStyle="#64748b"; ctx.lineWidth=3;
    ctx.beginPath(); ctx.ellipse(0,0,10,20,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.restore();
    // 검 (공격 스윙 표현)
    ctx.save(); ctx.translate(fc*14,-58);
    let swordAng=fc>0?-0.4:Math.PI+0.4;
    if(f.state==="attack"&&f.atk){ const ph=f.atk.phase; const prog= ph==="wind"?-0.9: ph==="act"?0.9:0.3; swordAng = (fc>0? -0.4 : Math.PI+0.4) + fc*prog; }
    ctx.rotate(swordAng);
    ctx.strokeStyle="#e2e8f0"; ctx.lineWidth=5; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(42,0); ctx.stroke();
    ctx.strokeStyle="#94a3b8"; ctx.lineWidth=8; ctx.beginPath(); ctx.moveTo(-4,0); ctx.lineTo(-10,0); ctx.stroke();
    // 액티브 프레임 검광
    if(f.state==="attack"&&f.atk&&f.atk.phase==="act"){ ctx.strokeStyle="rgba(255,255,255,.6)"; ctx.lineWidth=14; ctx.beginPath(); ctx.arc(0,0,42,-0.6,0.6); ctx.stroke(); }
    ctx.restore();
    ctx.restore();

    // 머리 위 HP/스태미너 (미니)
    const bw=58, bx=f.x-bw/2, by=f.y-134;
    ctx.fillStyle="rgba(0,0,0,.55)"; roundRect(ctx,bx-2,by-2,bw+4,13,3); ctx.fill();
    ctx.fillStyle="#3f1d2b"; roundRect(ctx,bx,by,bw,6,2); ctx.fill();
    ctx.fillStyle=main?"#22c55e":"#f43f5e"; roundRect(ctx,bx,by,bw*clamp(f.hp/f.maxHp,0,1),6,2); ctx.fill();
    ctx.fillStyle="#1e293b"; roundRect(ctx,bx,by+7,bw,4,2); ctx.fill();
    ctx.fillStyle="#38bdf8"; roundRect(ctx,bx,by+7,bw*clamp(f.stam/f.maxStam,0,1),4,2); ctx.fill();
    // 특수기 라벨
    if(f.specialT>0){ ctx.fillStyle="#f0abfc"; ctx.font="bold 13px system-ui"; ctx.textAlign="center"; ctx.fillText(f.special, f.x, by-8); }
    // 콤보
    if(f.combo>1){ ctx.fillStyle="#fbbf24"; ctx.font="bold 15px system-ui"; ctx.textAlign="center"; ctx.fillText(f.combo+" COMBO", f.x, f.y-150); }
    // 메시지
    if(f.msgT>0){ ctx.fillStyle="#fca5a5"; ctx.font="bold 12px system-ui"; ctx.textAlign="center"; ctx.fillText(f.msg,f.x,f.y-158); }
  };

  const draw=(ctx)=>{
    // 배경
    const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,"#241a30"); g.addColorStop(.55,"#1a1424"); g.addColorStop(1,"#120e1a");
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    // 관중석 실루엣
    ctx.fillStyle="#0d0a14"; ctx.fillRect(0,0,W,120);
    ctx.fillStyle="rgba(168,85,247,.05)"; ctx.beginPath(); ctx.arc(W/2,60,260,0,Math.PI*2); ctx.fill();
    // 바닥(모래)
    const fg=ctx.createLinearGradient(0,FLOOR-40,0,H); fg.addColorStop(0,"#3a2f22"); fg.addColorStop(1,"#241c14");
    ctx.fillStyle=fg; ctx.fillRect(0,FLOOR-8,W,H-FLOOR+8);
    ctx.strokeStyle="rgba(255,255,255,.05)"; ctx.lineWidth=2;
    for(let i=0;i<6;i++){ ctx.beginPath(); ctx.moveTo(80+i*130,FLOOR); ctx.lineTo(80+i*130+40,H); ctx.stroke(); }

    if(!p.current||!e.current)return; // 안전 가드

    // 파티클(뒤)
    for(const s of sparks.current){ const al=1-s.t/s.life; ctx.strokeStyle="rgba(253,224,71,"+al+")"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(s.x-s.vx*0.02,s.y-s.vy*0.02); ctx.stroke(); }

    // 파이터
    drawFighter(ctx,e.current,false);
    drawFighter(ctx,p.current,true);

    // 혈흔 파티클(앞)
    for(const q of parts.current){ const al=1-q.t/q.life; ctx.fillStyle=q.col.replace(")",","+al+")").replace("rgb","rgba"); ctx.globalAlpha=al; ctx.fillStyle=q.col; ctx.beginPath(); ctx.arc(q.x,q.y,q.r,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; }
    // 플로팅 텍스트
    for(const fl of floats.current){ const al=clamp(1-fl.t/fl.life,0,1); ctx.globalAlpha=al; ctx.fillStyle=fl.col; ctx.font="bold "+(fl.big?24:16)+"px system-ui"; ctx.textAlign="center"; ctx.strokeStyle="rgba(0,0,0,.6)"; ctx.lineWidth=3; ctx.strokeText(fl.txt,fl.x,fl.y); ctx.fillText(fl.txt,fl.x,fl.y); ctx.globalAlpha=1; }

    // 라운드 배너
    if(roundBanner.current.t>0){ const al=clamp(roundBanner.current.t,0,1); ctx.globalAlpha=Math.min(1,al*1.5); ctx.fillStyle="rgba(0,0,0,.5)"; ctx.fillRect(0,H/2-46,W,92); ctx.fillStyle="#fde047"; ctx.font="bold 44px system-ui"; ctx.textAlign="center"; ctx.fillText(roundBanner.current.txt,W/2,H/2+15); ctx.globalAlpha=1; }
  };

  /* ---------- 루프 & 입력 ---------- */
  useEffect(()=>{
    const cv=cvRef.current; if(!cv)return; const ctx=cv.getContext("2d");
    let raf, last=performance.now(), acc=0; const STEP=1/120;
    const loop=(now)=>{
      try{
        let dt=(now-last)/1000; last=now; if(dt>0.3)dt=0.3;
        if(hitstop.current>0){ hitstop.current-=dt; dt*=0.15; }
        acc+=dt; let guard=0;
        while(acc>=STEP&&guard++<40){ step(STEP); acc-=STEP; }
        // 화면 흔들림 적용
        let sx=0,sy=0; if(shake.current.t>0){ const m=shake.current.mag*(shake.current.t/0.22); sx=rand(-m,m); sy=rand(-m,m); }
        ctx.save(); ctx.translate(sx,sy); draw(ctx); ctx.restore();
      }catch(err){ console.error("glad loop error",err); }
      raf=requestAnimationFrame(loop);
    };
    raf=requestAnimationFrame(loop);

    const kd=(ev)=>{
      const key=ev.key.toLowerCase();
      if(["arrowleft","arrowright","arrowdown","arrowup"," "].includes(key))ev.preventDefault();
      if(phase.current!=="fight"){ return; }
      if(!keys.current[key]){ // 엣지 트리거
        if(key==="j")buf.current.light=true;
        if(key==="k")buf.current.heavy=true;
        if(key===" "||key==="shift")buf.current.dodge=true;
      }
      keys.current[key]=true;
      if(ev.key==="Shift")keys.current["shift"]=true;
    };
    const ku=(ev)=>{ const key=ev.key.toLowerCase(); keys.current[key]=false; if(ev.key==="Shift")keys.current["shift"]=false; };
    window.addEventListener("keydown",kd); window.addEventListener("keyup",ku);
    // 포커스 잃을 때 키 리셋
    const blur=()=>{ keys.current={}; };
    window.addEventListener("blur",blur);

    return ()=>{ cancelAnimationFrame(raf); window.removeEventListener("keydown",kd); window.removeEventListener("keyup",ku); window.removeEventListener("blur",blur); };
  },[]);

  /* ---------- UI ---------- */
  const Menu=()=>(
    <div className="absolute inset-0 flex items-center justify-center fadein" style={{background:"rgba(10,8,15,.72)"}}>
      <div className="glass rounded-2xl p-7 max-w-md text-center pop">
        <div className="text-5xl mb-1">⚔️</div>
        <h1 className="text-2xl font-black text-amber-300">검투사 아레나</h1>
        <p className="text-sm text-purple-200/80 mt-2 leading-relaxed">완벽한 타이밍의 <b className="text-yellow-300">패링</b>으로 적을 무너뜨리고<br/>연속기 <b className="text-fuchsia-300">콤보</b>로 반격하세요. 3판 2선승제!</p>
        <div className="mt-4 text-xs text-white/70 grid grid-cols-2 gap-1.5 text-left glass rounded-lg p-3">
          <div><kbd>A</kbd>/<kbd>D</kbd> 이동</div><div><kbd>J</kbd> 약공격 <kbd>K</kbd> 강공격</div>
          <div><kbd>L</kbd> 막기/패링</div><div><kbd>Space</kbd> 구르기(회피)</div>
        </div>
        <p className="text-[11px] text-cyan-200/70 mt-2">💡 적 공격 직전에 <kbd>L</kbd>을 누르면 <b>패링</b> → 반격 기회!</p>
        <div className="mt-4">
          <div className="text-xs text-white/60 mb-1.5">난이도 선택</div>
          <div className="flex gap-2 justify-center">
            {Object.keys(DIFF).map(d=>(
              <button key={d} onClick={()=>startMatch(d)} className="btng px-4 py-2 rounded-xl font-bold text-sm text-black" style={{background:DIFF[d].color}}>{DIFF[d].name}</button>
            ))}
          </div>
        </div>
        <div className="text-[11px] text-amber-200/70 mt-3">🏆 최고 연승: {ui.best}</div>
      </div>
    </div>
  );
  const RoundOver=()=>(
    <div className="absolute inset-0 flex items-center justify-center fadein" style={{background:"rgba(10,8,15,.55)"}}>
      <div className="glass rounded-2xl p-6 text-center pop">
        <div className="text-3xl font-black" style={{color: scoreP.current>scoreE.current?"#fde047":"#f87171"}}>{ui.sp} : {ui.se}</div>
        <p className="text-sm text-white/80 mt-1">라운드 {round.current} 종료</p>
        <button onClick={nextRound} className="btng mt-4 px-6 py-2.5 rounded-xl font-bold text-black bg-amber-400">다음 라운드 ▶</button>
      </div>
    </div>
  );
  const MatchOver=()=>(
    <div className="absolute inset-0 flex items-center justify-center fadein" style={{background:"rgba(10,8,15,.72)"}}>
      <div className="glass rounded-2xl p-7 text-center pop">
        <div className="text-5xl mb-1">{ui.sp>ui.se?"🏆":"💀"}</div>
        <h2 className="text-2xl font-black" style={{color:ui.sp>ui.se?"#fde047":"#f87171"}}>{ui.result}</h2>
        <p className="text-sm text-white/70 mt-1">최종 {ui.sp} : {ui.se} · 난이도 {DIFF[ui.diff].name}</p>
        <p className="text-[12px] text-amber-200/80 mt-2">🏆 최고 연승: {ui.best}</p>
        <div className="flex gap-2 justify-center mt-4">
          <button onClick={()=>startMatch(ui.diff)} className="btng px-5 py-2.5 rounded-xl font-bold text-black bg-amber-400">다시 대결</button>
          <button onClick={()=>{ phase.current="menu"; sync(); }} className="btng px-5 py-2.5 rounded-xl font-bold text-white bg-white/15">난이도 변경</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full flex flex-col items-center py-3 select-none">
      <div className="relative" style={{width:W}}>
        <div className="flex items-center justify-between mb-2 px-1" style={{width:W}}>
          <div className="text-amber-300 font-black text-sm">🛡️ 플레이어 {phase.current!=="menu"?"· "+ui.sp+"승":""}</div>
          <div className="text-white/60 text-xs">{phase.current==="fight"?"라운드 "+ui.round+" · "+DIFF[ui.diff].name:"검투사 아레나"}</div>
          <div className="text-fuchsia-300 font-black text-sm">{phase.current!=="menu"?ui.se+"승 · ":""}적 검투사 🗡️</div>
        </div>
        <canvas ref={cvRef} width={W} height={H} className="w-full shadow-2xl" style={{background:"#120e1a",border:"1px solid rgba(168,85,247,.25)"}}/>
        {ui.phase==="menu"&&<Menu/>}
        {ui.phase==="roundover"&&<RoundOver/>}
        {ui.phase==="matchover"&&<MatchOver/>}
      </div>
      <div className="mt-2 text-[11px] text-white/45" style={{width:W}}>
        <span className="text-white/70">조작:</span> <kbd>A</kbd><kbd>D</kbd> 이동 · <kbd>J</kbd> 약공 · <kbd>K</kbd> 강공 · <kbd>L</kbd> 막기(직전에 누르면 패링) · <kbd>Space</kbd> 구르기 &nbsp;|&nbsp; 콤보: <b className="text-fuchsia-300">L-L-H</b> 어퍼컷, <b className="text-fuchsia-300">H-H</b> 강타연계, <b className="text-fuchsia-300">L-H-L</b> 회전베기, <b className="text-fuchsia-300">L-L-L</b> 난무
      </div>
    </div>
  );
}

function roundRect(ctx,x,y,w,h,r){ if(w<2*r)r=w/2; if(h<2*r)r=h/2; ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

ReactDOM.createRoot(document.getElementById("root")).render(<Game/>);
</script>
</body>
</html>
'''


def gladiator_page():
    st.title("⚔️ 검투사 아레나")
    st.caption("실시간 패링/반격 액션! 적 공격 직전에 막기(L)로 패링해 반격 기회를 열고, 약·강 공격 콤보로 적 검투사를 쓰러뜨리세요. 난이도별 AI · 3판 2선승제 · 최고 연승 기록")
    components.html(GLADIATOR_HTML, height=600, scrolling=True)


# ==========================================
# 7-8. 🩸 나락의 심연 — 하드코어 RPG (React 임베드)
# ==========================================
ABYSS_RPG_HTML = r'''<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<script src="https://cdn.tailwindcss.com"></script>
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script>
  Babel.registerPreset('classic-react', { presets: [[Babel.availablePresets['react'], { runtime: 'classic' }]] });
</script>
<script type="module">
  // Trystero: 서버 없이 브라우저끼리 직접 연결(P2P). 광장(접속자/채팅/PvP 결투)에 사용.
  import { joinRoom } from 'https://esm.run/@trystero-p2p/torrent';
  window.__trystero = { joinRoom };
  window.dispatchEvent(new Event('trystero-ready'));
</script>
<style>
  html,body{margin:0;padding:0;background:#0b0a0d;font-family:ui-sans-serif,system-ui,'Segoe UI',sans-serif;color:#e4e0d8;}
  #root{min-height:100vh;}
  .panel{background:rgba(24,20,28,.78);border:1px solid rgba(148,110,80,.18);border-radius:12px;}
  .btn{transition:transform .08s,filter .08s;cursor:pointer;}
  .btn:hover{filter:brightness(1.18);transform:translateY(-1px);}
  .btn:active{transform:translateY(1px);}
  .btn:disabled{opacity:.4;cursor:not-allowed;filter:none;transform:none;}
  .pop{animation:pop .25s cubic-bezier(.2,1.4,.4,1);}
  @keyframes pop{from{transform:scale(.85);opacity:0}to{transform:scale(1);opacity:1}}
  .fadein{animation:fadein .3s ease;}
  @keyframes fadein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  .glow{text-shadow:0 0 12px rgba(255,120,60,.6);}
  .dfloat{position:absolute;animation:dfloat .9s ease-out forwards;pointer-events:none;font-weight:900;white-space:nowrap;z-index:30;}
  @keyframes dfloat{from{opacity:1;transform:translateY(0) scale(1)}30%{transform:translateY(-10px) scale(1.15)}to{opacity:0;transform:translateY(-48px) scale(.95)}}
  .shake{animation:shake .32s;}
  @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}50%{transform:translateX(5px)}75%{transform:translateX(-3px)}}
  .chip{display:inline-flex;align-items:center;gap:3px;padding:1px 8px;border-radius:9999px;font-size:10px;font-weight:700;}
  /* ===== 전설 스킬 컷씬 ===== */
  .cine{position:fixed;inset:0;z-index:90;overflow:hidden;pointer-events:none;}
  .cine-dim{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(10,6,16,.55) 0%,rgba(0,0,0,.93) 75%);animation:cineDim 2.6s ease forwards;}
  @keyframes cineDim{0%{opacity:0}8%{opacity:1}82%{opacity:1}100%{opacity:0}}
  .cine-bar{position:absolute;left:0;right:0;height:12vh;background:#000;z-index:5;}
  .cine-bar.t{top:0;animation:cineBT 2.6s cubic-bezier(.2,.9,.3,1) forwards;}
  .cine-bar.b{bottom:0;animation:cineBB 2.6s cubic-bezier(.2,.9,.3,1) forwards;}
  @keyframes cineBT{0%{transform:translateY(-100%)}7%{transform:translateY(0)}86%{transform:translateY(0)}100%{transform:translateY(-100%)}}
  @keyframes cineBB{0%{transform:translateY(100%)}7%{transform:translateY(0)}86%{transform:translateY(0)}100%{transform:translateY(100%)}}
  .cine-flash{position:absolute;inset:0;background:#fff;opacity:0;animation:cineFl 2.6s linear forwards;z-index:2;}
  @keyframes cineFl{0%,9%{opacity:0}11%{opacity:.95}18%{opacity:0}54%{opacity:0}56%{opacity:.45}62%{opacity:0}100%{opacity:0}}
  .cine-rays{position:absolute;left:50%;top:44%;width:200vmax;height:200vmax;transform:translate(-50%,-50%);background:repeating-conic-gradient(from 0deg,transparent 0deg 9deg,var(--cc) 9deg 10deg,transparent 10deg 18deg);opacity:0;animation:cineRay 2.6s ease forwards;filter:blur(1px);}
  @keyframes cineRay{0%,10%{opacity:0;transform:translate(-50%,-50%) rotate(0) scale(.4)}20%{opacity:.16}70%{opacity:.12;transform:translate(-50%,-50%) rotate(28deg) scale(1)}100%{opacity:0;transform:translate(-50%,-50%) rotate(40deg) scale(1.1)}}
  .cine-ring{position:absolute;left:50%;top:44%;width:20vmin;height:20vmin;border:3px solid var(--cc);border-radius:50%;transform:translate(-50%,-50%);opacity:0;animation:cineRing 1.1s ease-out .28s forwards;box-shadow:0 0 40px var(--cc);z-index:3;}
  @keyframes cineRing{0%{opacity:1;transform:translate(-50%,-50%) scale(.2)}100%{opacity:0;transform:translate(-50%,-50%) scale(6)}}
  .cine-icon{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);font-size:16vmin;z-index:4;opacity:0;animation:cineIc 2.6s cubic-bezier(.16,1,.3,1) forwards;filter:drop-shadow(0 0 6vmin var(--cc));}
  @keyframes cineIc{0%{opacity:0;transform:translate(-50%,-50%) scale(7) rotate(-14deg)}10%{opacity:1;transform:translate(-50%,-50%) scale(1) rotate(0)}13%{transform:translate(-48%,-52%) scale(1.12)}16%{transform:translate(-52%,-49%) scale(1.04)}19%{transform:translate(-50%,-50%) scale(1.08)}72%{opacity:1;transform:translate(-50%,-50%) scale(1.12)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.3)}}
  .cine-name{position:absolute;left:0;right:0;top:63%;text-align:center;z-index:4;font-size:6.2vmin;font-weight:900;letter-spacing:.35em;padding-left:.35em;background:linear-gradient(92deg,#fff 0%,var(--cc) 45%,#fff 60%,var(--cc) 100%);background-size:220% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;opacity:0;animation:cineNm 2.6s ease forwards;filter:drop-shadow(0 0 18px var(--cc));}
  @keyframes cineNm{0%,14%{opacity:0;transform:translateY(24px) scale(.92);letter-spacing:.8em}24%{opacity:1;transform:translateY(0) scale(1);letter-spacing:.35em}72%{opacity:1;background-position:200% 0}100%{opacity:0;transform:translateY(-10px)}}
  .cine-sub{position:absolute;left:0;right:0;top:74%;text-align:center;z-index:4;font-size:1.7vmin;letter-spacing:1.1em;padding-left:1.1em;color:rgba(255,255,255,.55);opacity:0;animation:cineSb 2.6s ease forwards;font-weight:700;}
  @keyframes cineSb{0%,22%{opacity:0}32%{opacity:1}74%{opacity:1}100%{opacity:0}}
  .cine-p{position:absolute;left:50%;top:44%;border-radius:50%;background:var(--cc);z-index:3;opacity:0;animation:cineP 1.5s ease-out forwards;box-shadow:0 0 12px var(--cc);}
  @keyframes cineP{0%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(.15)}}
  .cine-sweep{position:absolute;inset:-20%;background:linear-gradient(105deg,transparent 42%,rgba(255,255,255,.14) 50%,transparent 58%);transform:translateX(-120%);animation:cineSw 2.6s ease forwards;z-index:2;}
  @keyframes cineSw{0%,26%{transform:translateX(-120%)}44%{transform:translateX(120%)}100%{transform:translateX(120%)}}
  /* ===== 히든 스킬 울트라 컷씬 (4.4초 · 전설의 상위 연출) ===== */
  .ucine{position:fixed;inset:0;z-index:95;overflow:hidden;pointer-events:none;animation:uShake 4.4s linear forwards;}
  @keyframes uShake{0%,17%{transform:translate(0,0)}18%{transform:translate(-9px,6px)}19%{transform:translate(8px,-7px)}20%{transform:translate(-6px,-5px)}21%{transform:translate(5px,4px)}22%{transform:translate(0,0)}54%{transform:translate(0,0)}55%{transform:translate(-5px,4px)}56%{transform:translate(4px,-4px)}57%{transform:translate(0,0)}100%{transform:translate(0,0)}}
  .u-dim{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(8,4,14,.6) 0%,rgba(0,0,0,.97) 72%);animation:uDim 4.4s ease forwards;}
  @keyframes uDim{0%{opacity:0}6%{opacity:1}88%{opacity:1}100%{opacity:0}}
  .u-bar{position:absolute;left:0;right:0;height:14vh;background:#000;z-index:6;border-bottom:1px solid var(--cc);}
  .u-bar.t{top:0;animation:uBT 4.4s cubic-bezier(.2,.9,.3,1) forwards;}
  .u-bar.b{bottom:0;border-bottom:none;border-top:1px solid var(--cc);animation:uBB 4.4s cubic-bezier(.2,.9,.3,1) forwards;}
  @keyframes uBT{0%{transform:translateY(-100%)}5%{transform:translateY(0)}90%{transform:translateY(0)}100%{transform:translateY(-100%)}}
  @keyframes uBB{0%{transform:translateY(100%)}5%{transform:translateY(0)}90%{transform:translateY(0)}100%{transform:translateY(100%)}}
  .u-circle{position:absolute;left:50%;top:42%;width:64vmin;height:64vmin;border:2px dashed var(--cc);border-radius:50%;opacity:0;animation:uCir 4.4s linear forwards;box-shadow:0 0 30px var(--cc),inset 0 0 30px rgba(255,255,255,.06);}
  .u-circle.c2{width:46vmin;height:46vmin;border-style:dotted;animation:uCir2 4.4s linear forwards;}
  @keyframes uCir{0%,4%{opacity:0;transform:translate(-50%,-50%) rotate(0) scale(1.6)}12%{opacity:.8;transform:translate(-50%,-50%) rotate(40deg) scale(1)}80%{opacity:.5;transform:translate(-50%,-50%) rotate(300deg) scale(1)}100%{opacity:0;transform:translate(-50%,-50%) rotate(360deg) scale(1.15)}}
  @keyframes uCir2{0%,4%{opacity:0;transform:translate(-50%,-50%) rotate(0) scale(.4)}12%{opacity:.9;transform:translate(-50%,-50%) rotate(-50deg) scale(1)}80%{opacity:.55;transform:translate(-50%,-50%) rotate(-320deg) scale(1)}100%{opacity:0;transform:translate(-50%,-50%) rotate(-380deg) scale(.85)}}
  .u-pillar{position:absolute;bottom:0;top:0;width:7vmin;background:linear-gradient(180deg,transparent,var(--cc) 45%,transparent);opacity:0;filter:blur(6px);animation:uPil 4.4s ease forwards;}
  @keyframes uPil{0%,8%{opacity:0;transform:translateY(60%) scaleY(.3)}16%{opacity:.5;transform:translateY(0) scaleY(1)}78%{opacity:.28}100%{opacity:0;transform:translateY(-30%)}}
  .u-rays{position:absolute;left:50%;top:42%;width:220vmax;height:220vmax;transform:translate(-50%,-50%);background:repeating-conic-gradient(from 0deg,transparent 0deg 6deg,var(--cc) 6deg 7deg,transparent 7deg 13deg);opacity:0;animation:uRay 4.4s ease forwards;filter:blur(1px);}
  @keyframes uRay{0%,7%{opacity:0;transform:translate(-50%,-50%) rotate(0) scale(.35)}16%{opacity:.2}82%{opacity:.14;transform:translate(-50%,-50%) rotate(55deg) scale(1)}100%{opacity:0;transform:translate(-50%,-50%) rotate(70deg) scale(1.1)}}
  .u-ring{position:absolute;left:50%;top:42%;width:22vmin;height:22vmin;border:4px solid var(--cc);border-radius:50%;transform:translate(-50%,-50%);opacity:0;animation:uRing 1.15s ease-out forwards;box-shadow:0 0 50px var(--cc);z-index:4;}
  @keyframes uRing{0%{opacity:1;transform:translate(-50%,-50%) scale(.15)}100%{opacity:0;transform:translate(-50%,-50%) scale(7)}}
  .u-icon{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);font-size:21vmin;z-index:5;opacity:0;animation:uIc 4.4s cubic-bezier(.16,1,.3,1) forwards;filter:drop-shadow(0 0 8vmin var(--cc)) drop-shadow(0 0 2vmin #fff);}
  @keyframes uIc{0%,6%{opacity:0;transform:translate(-50%,-50%) scale(9) rotate(-20deg)}16%{opacity:1;transform:translate(-50%,-50%) scale(1) rotate(0)}19%{transform:translate(-47%,-53%) scale(1.16)}22%{transform:translate(-53%,-48%) scale(1.05)}25%{transform:translate(-50%,-50%) scale(1.1)}52%{transform:translate(-50%,-50%) scale(1.1)}56%{transform:translate(-50%,-50%) scale(1.22)}60%{transform:translate(-50%,-50%) scale(1.12)}84%{opacity:1;transform:translate(-50%,-50%) scale(1.16)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.45)}}
  .u-echo{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);font-size:21vmin;z-index:4;opacity:0;animation:uEcho 1.4s ease-out forwards;filter:blur(2px);}
  @keyframes uEcho{0%,38%{opacity:0;transform:translate(-50%,-50%) scale(1)}48%{opacity:.4}100%{opacity:0;transform:translate(-50%,-50%) scale(2.1)}}
  .u-cname{position:absolute;left:0;right:0;top:60.5%;text-align:center;z-index:6;font-size:2.2vmin;letter-spacing:.9em;padding-left:.9em;color:var(--cc);opacity:0;animation:uCn 4.4s ease forwards;font-weight:800;text-shadow:0 0 14px var(--cc);}
  @keyframes uCn{0%,20%{opacity:0;transform:translateY(10px)}28%{opacity:.95;transform:translateY(0)}84%{opacity:.95}100%{opacity:0}}
  .u-name{position:absolute;left:0;right:0;top:64%;text-align:center;z-index:6;font-size:8vmin;font-weight:900;}
  .u-ch{display:inline-block;opacity:0;background:linear-gradient(180deg,#fff 15%,var(--cc) 70%,#fff);-webkit-background-clip:text;background-clip:text;color:transparent;animation:uCh 3.2s ease forwards;filter:drop-shadow(0 0 20px var(--cc));letter-spacing:.12em;}
  @keyframes uCh{0%{opacity:0;transform:translateY(34px) rotate(8deg) scale(1.6)}14%{opacity:1;transform:translateY(0) rotate(0) scale(1)}86%{opacity:1}100%{opacity:0;transform:translateY(-12px)}}
  .u-sub{position:absolute;left:0;right:0;top:77%;text-align:center;z-index:6;font-size:1.9vmin;letter-spacing:1.4em;padding-left:1.4em;color:rgba(255,255,255,.6);opacity:0;animation:uSb 4.4s ease forwards;font-weight:700;}
  @keyframes uSb{0%,30%{opacity:0}40%{opacity:1}84%{opacity:1}100%{opacity:0}}
  .u-p{position:absolute;left:50%;top:42%;border-radius:50%;background:var(--cc);z-index:4;opacity:0;box-shadow:0 0 14px var(--cc);}
  .u-p.out{animation:uPo 1.9s ease-out forwards;}
  @keyframes uPo{0%{opacity:1;transform:translate(-50%,-50%) scale(1.1)}100%{opacity:0;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(.1)}}
  .u-p.inn{animation:uPi 1.1s ease-in forwards;}
  @keyframes uPi{0%{opacity:0;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(.2)}25%{opacity:.9}100%{opacity:0;transform:translate(-50%,-50%) scale(1.2)}}
  .u-flash{position:absolute;inset:0;background:#fff;opacity:0;animation:uFl 4.4s linear forwards;z-index:3;}
  @keyframes uFl{0%,14%{opacity:0}16%{opacity:1}24%{opacity:0}53%{opacity:0}55%{opacity:.7}61%{opacity:0}86%{opacity:0}90%{opacity:.9}100%{opacity:0}}
  .u-sweep{position:absolute;inset:-20%;background:linear-gradient(100deg,transparent 40%,rgba(255,255,255,.2) 50%,transparent 60%);transform:translateX(-130%);animation:uSw 4.4s ease forwards;z-index:3;}
  @keyframes uSw{0%,30%{transform:translateX(-130%)}52%{transform:translateX(130%)}100%{transform:translateX(130%)}}
  /* ===== 전투 공격 모션 ===== */
  .atk-layer{position:absolute;inset:-14px;pointer-events:none;z-index:20;}
  .fx-slash{position:absolute;left:-25%;top:46%;width:150%;height:5px;border-radius:6px;background:linear-gradient(90deg,transparent,#fff,#ffe28a,transparent);box-shadow:0 0 12px #ffd76a;opacity:0;animation:fxSlash .34s ease-out forwards;}
  @keyframes fxSlash{0%{opacity:0;transform:rotate(-28deg) translateX(-45%) scaleX(.25)}22%{opacity:1}100%{opacity:0;transform:rotate(-28deg) translateX(45%) scaleX(1.15)}}
  .fx-impact{position:absolute;left:50%;top:50%;width:16px;height:16px;border:3px solid #ffd76a;border-radius:50%;transform:translate(-50%,-50%);opacity:0;animation:fxImpact .42s ease-out forwards;}
  @keyframes fxImpact{0%{opacity:1;transform:translate(-50%,-50%) scale(.3)}100%{opacity:0;transform:translate(-50%,-50%) scale(3.4)}}
  .fx-burst{position:absolute;left:50%;top:50%;width:64px;height:64px;border-radius:50%;background:radial-gradient(circle,rgba(255,225,130,.95),rgba(255,120,60,.4) 55%,transparent 72%);transform:translate(-50%,-50%);opacity:0;animation:fxBurst .48s ease-out forwards;}
  @keyframes fxBurst{0%{opacity:1;transform:translate(-50%,-50%) scale(.2)}100%{opacity:0;transform:translate(-50%,-50%) scale(2.6)}}
  .lunge{animation:lunge .42s ease;}
  @keyframes lunge{0%{transform:translateX(0)}38%{transform:translateX(-15px) scale(1.1)}100%{transform:translateX(0)}}
  .hurt-flash{position:fixed;inset:0;pointer-events:none;z-index:45;background:radial-gradient(ellipse at center,transparent 52%,rgba(220,38,38,.4));animation:hurtF .5s ease-out forwards;}
  @keyframes hurtF{0%{opacity:1}100%{opacity:0}}
  input{outline:none;}
  ::-webkit-scrollbar{width:8px;height:8px}::-webkit-scrollbar-thumb{background:#4a3a30;border-radius:8px}::-webkit-scrollbar-track{background:#17131a}
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel" data-presets="classic-react">
const { useState, useRef, useEffect, useReducer } = React;
const R=Math.random;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const FMT_U=["","K","M","B","T","Q","Qi","Sx","Sp","Oc","No","Dc","UDc","DDc","TDc","QaDc","QiDc","SxDc","SpDc","OcDc","NoDc","Vg"];
const fmt=n=>{ n=Math.floor(n); if(!isFinite(n))return "∞"; if(n<1e4)return n.toLocaleString();
  let u=0, v=n; while(v>=1000&&u<FMT_U.length-1){ v/=1000; u++; }
  if(v>=1000)return n.toExponential(2);
  return (v>=100?v.toFixed(1):v.toFixed(2))+FMT_U[u]; };
const hashPw=s=>{let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return String(h);};
const KEYP="ynd_rpg2_sav_";
const needXp=lv=>Math.floor(60*Math.pow(1.5,lv-1));
function ensureTrystero(cb){
  if(window.__trystero){ cb(window.__trystero); return; }
  const h=()=>{ window.removeEventListener("trystero-ready",h); cb(window.__trystero); };
  window.addEventListener("trystero-ready",h);
}

/* ===================== 직업 (13종) =====================
   grp: 히든 직업 전직 계열(warrior/mage/thief) — 신규 직업도 계열에 따라 같은 히든 트리 사용 */
const CLS={
  warrior:{name:"전사",icon:"⚔️",grp:"warrior",desc:"높은 체력과 방어력의 근접 전선. 안정적인 성장.",base:{hp:160,mp:30,atk:13,def:9,crit:5,critd:150},grow:{hp:24,mp:4,atk:3.1,def:2.3,crit:.1,critd:1},hidden:"dragonKnight"},
  mage:{name:"마법사",icon:"🔮",grp:"mage",desc:"압도적 마법 화력. 유리몸이지만 최고의 폭딜.",base:{hp:105,mp:85,atk:16,def:4,crit:8,critd:160},grow:{hp:13,mp:13,atk:3.7,def:1.2,crit:.2,critd:2},hidden:"darkMage"},
  thief:{name:"도적",icon:"🥷",grp:"thief",desc:"치명타 특화. 급소를 노리는 한 방의 미학.",base:{hp:120,mp:45,atk:14,def:5,crit:15,critd:185},grow:{hp:16,mp:6,atk:3.3,def:1.5,crit:.45,critd:3},hidden:"assassin"},
  knight:{name:"수호기사",icon:"🛡️",grp:"warrior",desc:"철벽의 방어와 굳건한 심장. 파티의 방패.",base:{hp:200,mp:25,atk:10,def:14,crit:3,critd:140},grow:{hp:30,mp:3,atk:2.6,def:3.0,crit:.08,critd:.8}},
  monk:{name:"무도가",icon:"🥊",grp:"warrior",desc:"맨주먹 연타의 달인. 폭풍 같은 몰아치기.",base:{hp:150,mp:40,atk:12,def:7,crit:9,critd:155},grow:{hp:20,mp:5,atk:3.0,def:1.9,crit:.25,critd:1.5}},
  lancer:{name:"창술사",icon:"🔱",grp:"warrior",desc:"긴 사거리의 일점 관통. 묵직한 정확함.",base:{hp:165,mp:35,atk:14,def:8,crit:6,critd:160},grow:{hp:22,mp:4,atk:3.4,def:2.0,crit:.15,critd:1.2}},
  priest:{name:"사제",icon:"✨",grp:"mage",desc:"신성 마법과 자가 회복. 쓰러지지 않는 성전.",base:{hp:130,mp:90,atk:12,def:6,crit:5,critd:145},grow:{hp:17,mp:12,atk:3.0,def:1.6,crit:.12,critd:.9}},
  warlock:{name:"주술사",icon:"🧿",grp:"mage",desc:"저주와 지속 피해로 서서히 갉아먹는다.",base:{hp:115,mp:80,atk:15,def:5,crit:7,critd:155},grow:{hp:14,mp:11,atk:3.5,def:1.3,crit:.18,critd:1.8}},
  bard:{name:"음유시인",icon:"🎻",grp:"mage",desc:"전장의 선율. 버프와 교란의 명수.",base:{hp:125,mp:70,atk:13,def:6,crit:8,critd:150},grow:{hp:16,mp:9,atk:3.2,def:1.5,crit:.2,critd:1.4}},
  summoner:{name:"소환사",icon:"🪄",grp:"mage",desc:"정령과 계약해 싸우는 소환의 대가.",base:{hp:120,mp:95,atk:14,def:5,crit:6,critd:150},grow:{hp:15,mp:13,atk:3.4,def:1.4,crit:.15,critd:1.3}},
  archer:{name:"궁수",icon:"🏹",grp:"thief",desc:"원거리 정밀 사격. 치명적 일격의 미학.",base:{hp:125,mp:50,atk:15,def:5,crit:12,critd:170},grow:{hp:17,mp:6,atk:3.4,def:1.4,crit:.35,critd:2.2}},
  gunner:{name:"총사",icon:"🔫",grp:"thief",desc:"화약과 연사. 폭발적인 순간 화력.",base:{hp:120,mp:55,atk:16,def:4,crit:10,critd:165},grow:{hp:16,mp:7,atk:3.6,def:1.2,crit:.3,critd:2.0}},
  reaper:{name:"사신",icon:"🌒",grp:"thief",desc:"영혼을 거두는 낫. 처형의 화신.",base:{hp:135,mp:60,atk:15,def:6,crit:11,critd:175},grow:{hp:18,mp:7,atk:3.5,def:1.5,crit:.32,critd:2.5}},
};
const HID={
  dragonKnight:{name:"용기사",icon:"🐲",base:"warrior",need:"Lv20 도달 + 드래곤류 50마리 처치",check:(s,st)=>s.lv>=20&&(s.tagKills.dragon||0)>=50,mult:{atk:1.35,hp:1.3,def:1.2,mp:1.1,critF:0,critdF:20},skill:"dragonBreath"},
  darkMage:{name:"흑마법사",icon:"💀",base:"mage",need:"Lv20 도달 + 언데드 100마리 처치",check:(s,st)=>s.lv>=20&&(s.tagKills.undead||0)>=100,mult:{atk:1.5,hp:1.1,def:1.05,mp:1.4,critF:5,critdF:0},skill:"soulDrain"},
  assassin:{name:"암살자",icon:"🌑",base:"thief",need:"Lv20 도달 + 치명타 확률 40% 이상",check:(s,st)=>s.lv>=20&&st.crit>=40,mult:{atk:1.3,hp:1.15,def:1.1,mp:1.2,critF:10,critdF:40},skill:"silentKill"},
};

/* ===================== 스킬 =====================
   fx: stun(기절) gcrit(확정치명) critB(치명확률+) critdB(치피+) heal(피해흡혈%) selfHeal(최대HP%회복)
       shield(최대HP% 보호막) atkB/critBf/dodge({v,t} 버프) deb({v,t} 적 공격력 감소) dot({k,pct,t} 지속피해)
       exec({below,mult} 처형) mpR(최대MP% 회복) / hits: 연속 타격 수 / mult 0 = 비공격(보조) 스킬 */
const SKILLS={
  /* --- 전사 (10) --- */
  powerStrike:{name:"강타",icon:"💢",cls:"warrior",lv:1,mp:8,mult:1.8,desc:"180% 피해의 묵직한 일격"},
  ironWall:{name:"방패 올리기",icon:"🛡️",cls:"warrior",lv:4,mp:12,mult:0,fx:{shield:.3},desc:"최대 HP 30% 보호막 생성"},
  shieldBash:{name:"방패 치기",icon:"💥",cls:"warrior",lv:8,mp:15,mult:1.5,fx:{stun:1},desc:"150% 피해 + 적 1턴 기절"},
  taunt:{name:"도발",icon:"😤",cls:"warrior",lv:12,mp:14,mult:1.2,fx:{deb:{v:.25,t:3}},desc:"120% 피해 + 적 공격력 -25% (3턴)"},
  warCry:{name:"전쟁의 함성",icon:"📣",cls:"warrior",lv:16,mp:20,mult:0,fx:{atkB:{v:.35,t:3}},desc:"공격력 +35% (3턴)"},
  whirlwind:{name:"회전 베기",icon:"🌪️",cls:"warrior",lv:20,mp:24,mult:2.4,desc:"240% 회전 참격"},
  execute:{name:"처형",icon:"⚰️",cls:"warrior",lv:24,mp:26,mult:2.0,fx:{exec:{below:.3,mult:2.2}},desc:"200% 피해, 적 HP 30% 미만 시 440%"},
  indomitable:{name:"불굴",icon:"✊",cls:"warrior",lv:28,mp:30,mult:0,fx:{selfHeal:.35},desc:"최대 HP 35% 회복"},
  earthSplit:{name:"대지 가르기",icon:"⛰️",cls:"warrior",lv:32,mp:34,mult:3.2,fx:{stun:1},desc:"320% 피해 + 기절"},
  ragnarok:{name:"라그나로크",icon:"🌋",cls:"warrior",lv:36,mp:45,mult:5.0,desc:"500% 필멸의 일격"},
  /* --- 마법사 (10) --- */
  fireball:{name:"파이어볼",icon:"🔥",cls:"mage",lv:1,mp:10,mult:2.0,desc:"200% 화염 피해"},
  manaShield:{name:"마나 실드",icon:"🔵",cls:"mage",lv:4,mp:14,mult:0,fx:{shield:.35},desc:"최대 HP 35% 마력 보호막"},
  iceSpear:{name:"아이스 스피어",icon:"🧊",cls:"mage",lv:8,mp:16,mult:2.3,fx:{stun:1},desc:"230% 피해 + 적 1턴 빙결"},
  ignite:{name:"점화",icon:"🕯️",cls:"mage",lv:12,mp:18,mult:1.3,fx:{dot:{k:"burn",pct:.5,t:3}},desc:"130% 피해 + 화상(3턴 지속피해)"},
  arcaneFocus:{name:"비전 집중",icon:"✨",cls:"mage",lv:16,mp:22,mult:0,fx:{atkB:{v:.4,t:3}},desc:"공격력 +40% (3턴)"},
  chainLightning:{name:"체인 라이트닝",icon:"⚡",cls:"mage",lv:20,mp:26,mult:1.1,hits:3,desc:"110% × 3연격 번개"},
  manaBurn:{name:"마나 번",icon:"🌀",cls:"mage",lv:24,mp:28,mult:2.6,fx:{mpR:.2},desc:"260% 피해 + 최대 MP 20% 회수"},
  lifeConvert:{name:"생명 변환",icon:"💞",cls:"mage",lv:28,mp:36,mult:0,fx:{selfHeal:.3},desc:"최대 HP 30% 회복"},
  blizzard:{name:"블리자드",icon:"❄️",cls:"mage",lv:32,mp:38,mult:3.4,fx:{stun:1},desc:"340% 피해 + 빙결"},
  armageddon:{name:"아마겟돈",icon:"☄️",cls:"mage",lv:36,mp:50,mult:5.5,desc:"550% 종말의 화염"},
  /* --- 도적 (10) --- */
  vitalStab:{name:"급소 찌르기",icon:"🎯",cls:"thief",lv:1,mp:8,mult:1.6,fx:{critB:25},desc:"160% 피해, 치명타 확률 +25%"},
  smokeScreen:{name:"연막",icon:"💨",cls:"thief",lv:4,mp:12,mult:0,fx:{dodge:{v:.5,t:3}},desc:"3턴간 적 공격 50% 회피"},
  poisonBlade:{name:"독날",icon:"🐍",cls:"thief",lv:8,mp:15,mult:1.5,fx:{dot:{k:"poison",pct:.45,t:3}},desc:"150% 피해 + 중독(3턴 지속피해)"},
  doubleSlash:{name:"이단 베기",icon:"⚔️",cls:"thief",lv:12,mp:16,mult:.95,hits:2,desc:"95% × 2연격"},
  huntPrep:{name:"사냥 준비",icon:"🏹",cls:"thief",lv:16,mp:18,mult:0,fx:{critBf:{v:30,t:3}},desc:"치명타 확률 +30% (3턴)"},
  shadowStrike:{name:"그림자 일격",icon:"🌫️",cls:"thief",lv:20,mp:24,mult:2.6,fx:{gcrit:1},desc:"260% 피해, 확정 치명타"},
  flurry:{name:"급소 연타",icon:"🗡️",cls:"thief",lv:24,mp:28,mult:.85,hits:3,desc:"85% × 3연격, 각각 치명타 가능"},
  vampBlade:{name:"흡혈 단검",icon:"🩸",cls:"thief",lv:28,mp:30,mult:2.2,fx:{heal:.4},desc:"220% 피해 + 피해의 40% 흡혈"},
  assassinate:{name:"암살",icon:"🌑",cls:"thief",lv:32,mp:36,mult:3.5,fx:{gcrit:1},desc:"350% 확정 치명타"},
  deathBlow:{name:"절명",icon:"☠️",cls:"thief",lv:36,mp:44,mult:3.0,fx:{exec:{below:.25,mult:3}},desc:"300% 피해, 적 HP 25% 미만 시 900%"},
  /* --- 히든 직업 (각 2) --- */
  dragonBreath:{name:"용의 숨결",icon:"🐲",cls:"dragonKnight",lv:20,mp:36,mult:4.4,cine:"ultra",desc:"[히든] 440% 용염 피해"},
  dragonHeart:{name:"드래곤 하트",icon:"❤️‍🔥",cls:"dragonKnight",lv:30,mp:42,mult:0,cine:"ultra",fx:{selfHeal:.5,atkB:{v:.5,t:3}},desc:"[히든] HP 50% 회복 + 공격력 +50% (3턴)"},
  soulDrain:{name:"영혼 흡수",icon:"💀",cls:"darkMage",lv:20,mp:32,mult:3.4,cine:"ultra",fx:{heal:.35},desc:"[히든] 340% 피해 + 35% 흡혈"},
  deathSentence:{name:"죽음의 선고",icon:"⚱️",cls:"darkMage",lv:30,mp:48,mult:6.0,cine:"ultra",desc:"[히든] 600% 죽음의 선고"},
  silentKill:{name:"침묵의 암살",icon:"🌑",cls:"assassin",lv:20,mp:30,mult:3.2,cine:"ultra",fx:{gcrit:1,critdB:80},desc:"[히든] 320% 확정 치명타 + 치피 +80%"},
  shadowClones:{name:"그림자 분신",icon:"👥",cls:"assassin",lv:30,mp:46,mult:.9,hits:4,cine:"ultra",fx:{gcrit:1},desc:"[히든] 90% × 4연격, 전부 확정 치명타"},
};

/* ===================== 히든 직업 확장 (총 53종) =====================
   각 히든 직업은 고유 조건·고유 스킬·전용 스탯 보정을 가진다. 전직은 1회 영구. */
const sumV=o=>Object.values(o||{}).reduce((a,b)=>a+b,0);
const tk=(s,t)=>s.tagKills[t]||0;
const HFX={
  gcrit:{fx:{gcrit:1},d:"확정 치명타"},
  heal:{fx:{heal:.35},d:"피해의 35% 흡혈"},
  stun:{fx:{stun:1},d:"적 1턴 기절"},
  burn:{fx:{dot:{k:"burn",pct:.55,t:3}},d:"강력한 화상(3턴)"},
  poison:{fx:{dot:{k:"poison",pct:.55,t:3}},d:"맹독(3턴)"},
  hits2:{hits:2,d:"2연격"},
  hits3:{hits:3,d:"3연격"},
  exec:{fx:{exec:{below:.3,mult:2}},d:"적 HP 30% 미만 시 피해 2배"},
  buff:{fx:{atkB:{v:.4,t:3}},d:"공격력 +40%(3턴)"},
  shield:{fx:{selfHeal:.25,shield:.25},d:"HP 25% 회복 + 보호막"},
  critd:{fx:{gcrit:1,critdB:60},d:"확정 치명타 + 치피 +60%"},
  mpr:{fx:{mpR:.25},d:"최대 MP 25% 회수"},
};
/* [id, 기반직업, 이름, 아이콘, 등급(1~5), 조건 설명, 조건 검사, 스킬명, 스킬 아이콘, 스킬 패턴] */
const HROWS=[
 ["berserker","warrior","광전사","😡",1,"누적 500마리 처치",(s,st)=>s.killTotal>=500,"피의 분노","🩸","heal"],
 ["paladin","warrior","성기사","⚜️",2,"Lv25 도달 + 사망 0회",(s,st)=>s.lv>=25&&s.deaths===0,"심판의 빛","🌟","shield"],
 ["juggernaut","warrior","파괴전차","🛡️",3,"방어력 300 이상",(s,st)=>st.def>=300,"철갑 돌진","💥","stun"],
 ["warlord","warrior","전쟁군주","👑",2,"보스 누적 10회 처치",(s,st)=>sumV(s.bossKills)>=10,"군주의 명령","⚔️","buff"],
 ["gladiatorH","warrior","검투왕","🏛️",2,"PvP 5승",(s,st)=>s.pvpW>=5,"투기장의 포효","📣","hits2"],
 ["dragonSlayer","warrior","용살자","🗡️",3,"드래곤류 300마리 처치",(s,st)=>tk(s,"dragon")>=300,"용멸섬","🐉","exec"],
 ["titan","warrior","거신","🗿",3,"최대 HP 10,000 이상",(s,st)=>st.hp>=10000,"대지 붕괴","⛰️","stun"],
 ["deathKnight","warrior","죽음의 기사","⚰️",3,"사망 10회 + 언데드 200마리",(s,st)=>s.deaths>=10&&tk(s,"undead")>=200,"망자의 검","💀","heal"],
 ["vanguard","warrior","선봉장","🚩",2,"서로 다른 맵 30곳 방문",(s,st)=>Object.keys(s.visits).length>=30,"돌파 선언","🏇","hits2"],
 ["smithLord","warrior","전장의 대장장이","⚒️",2,"장비 강화 성공 30회",(s,st)=>s.enhOk>=30,"모루 내려찍기","🔨","stun"],
 ["colossus","warrior","강철 거인","⚙️",4,"기계류 200마리 처치",(s,st)=>tk(s,"machine")>=200,"파쇄 기동","🤖","exec"],
 ["flameGuard","warrior","화염 수호자","🔥",4,"Lv100 + 화염 심연 진입",(s,st)=>s.lv>=100&&(s.visits.hf1||0)>=1,"작열 방패","♨️","burn"],
 ["abyssalLord","warrior","심연 군주","🕳️",5,"공허류 500마리 처치",(s,st)=>tk(s,"void")>=500,"나락 강타","🌑","critd"],
 ["immortal","warrior","불멸자","💎",5,"Lv80 도달 + 사망 0회",(s,st)=>s.lv>=80&&s.deaths===0,"불멸의 일격","✨","shield"],
 ["beastMaster","warrior","야수왕","🐺",3,"야수류 400마리 처치",(s,st)=>tk(s,"beast")>=400,"야성 해방","🐾","hits3"],
 ["runeKnight","warrior","룬 기사","💠",2,"룬 합성 20회",(s,st)=>s.fuseCount>=20,"룬 블레이드","🔷","mpr"],
 ["elementalist","mage","원소술사","🌈",2,"정령류 100마리 처치",(s,st)=>tk(s,"elemental")>=100,"원소 폭발","💥","burn"],
 ["necromancer","mage","강령술사","🦴",3,"언데드 300마리 처치",(s,st)=>tk(s,"undead")>=300,"시체 폭발","☠️","poison"],
 ["stormCaller","mage","폭풍 소환사","🌩️",3,"Lv60 + 천공 섬 진입",(s,st)=>s.lv>=60&&(s.visits.sk1||0)>=1,"천둥 강림","⚡","hits3"],
 ["sage","mage","대현자","📖",2,"퀘스트 누적 30회 완료",(s,st)=>sumV(s.questsDone)>=30,"지혜의 섬광","🌟","mpr"],
 ["frostWeaver","mage","서리 직조자","❄️",4,"빙결 리치 100마리 처치",(s,st)=>(s.kills.iceLich||0)>=100,"절대영도","🧊","stun"],
 ["pyromancer","mage","겁화술사","🔥",4,"지옥 임프 100마리 처치",(s,st)=>(s.kills.hellImp||0)>=100,"겁화","🌋","burn"],
 ["voidMage","mage","공허 마도사","🌀",5,"공허류 300마리 처치",(s,st)=>tk(s,"void")>=300,"공허 붕괴","🕳️","critd"],
 ["archmage","mage","대마법사","🧙",3,"최대 MP 2,000 이상",(s,st)=>st.mp>=2000,"마나 해일","🌊","mpr"],
 ["alchemist","mage","연금술사","⚗️",2,"골드 100만 보유",(s,st)=>s.gold>=1e6,"황금 변환","💰","poison"],
 ["chronomancer","mage","시간술사","⏳",3,"여관 휴식 30회",(s,st)=>s.innCount>=30,"시간 정지","🕰️","stun"],
 ["starSeer","mage","별의 예언자","🌠",4,"별의 잔해 진입",(s,st)=>(s.visits.st1||0)>=1,"유성우","☄️","hits3"],
 ["runeMasterH","mage","룬 마스터","💠",3,"전설 등급 룬 3개 보유",(s,st)=>s.runes.filter(r=>r.g>=6).length>=3,"룬 폭풍","🔮","buff"],
 ["demonologist","mage","악마학자","😈",4,"악마류 250마리 처치",(s,st)=>tk(s,"demon")>=250,"악마 소환","👿","heal"],
 ["lifeBinder","mage","생명 결속자","💞",2,"월드 퀘스트 달성",(s,st)=>s.world.done,"생명의 맥동","🌿","shield"],
 ["mindBreaker","mage","정신 파괴자","🧠",3,"PvP 10승",(s,st)=>s.pvpW>=10,"정신 붕괴","💫","stun"],
 ["voidWalker","mage","공허 방랑자","🌌",4,"서로 다른 맵 40곳 방문",(s,st)=>Object.keys(s.visits).length>=40,"차원 균열","🌀","exec"],
 ["nightBlade","thief","밤의 검","🌙",2,"치명타 확률 50% 이상",(s,st)=>st.crit>=50,"월광 베기","🌙","gcrit"],
 ["venomancer","thief","맹독술사","🐍",3,"식인 꽃 100마리 처치",(s,st)=>(s.kills.manEater||0)>=100,"맹독 폭발","☠️","poison"],
 ["pirateKing","thief","해적왕","🏴‍☠️",3,"크라켄 촉수 100마리 처치",(s,st)=>(s.kills.kraken||0)>=100,"해적의 급습","⚓","hits2"],
 ["shadowDancer","thief","그림자 무희","💃",3,"Lv40 + 사망 2회 이하",(s,st)=>s.lv>=40&&s.deaths<=2,"환영무","🌫️","gcrit"],
 ["trickster","thief","기교왕","🎭",2,"던전 누적 20회 클리어",(s,st)=>sumV(s.dgClears)>=20,"속임수 연격","🃏","hits3"],
 ["bountyHunter","thief","현상금 사냥꾼","💰",4,"서로 다른 보스 20종 처치",(s,st)=>Object.keys(s.bossKills).length>=20,"현상 집행","🎯","exec"],
 ["phantomH","thief","팬텀","👻",3,"원혼 150마리 처치",(s,st)=>(s.kills.ghost||0)>=150,"유령 일격","🌫️","gcrit"],
 ["plunderer","thief","약탈자","💎",4,"골드 1,000만 보유",(s,st)=>s.gold>=1e7,"강탈","🪙","heal"],
 ["duelist","thief","결투가","🤺",4,"PvP 20승",(s,st)=>s.pvpW>=20,"필살 찌르기","🗡️","critd"],
 ["stalker","thief","추적자","🐾",3,"야수류 250마리 처치",(s,st)=>tk(s,"beast")>=250,"사냥 개시","🏹","hits2"],
 ["saboteur","thief","파괴공작원","🧨",4,"기계류 300마리 처치",(s,st)=>tk(s,"machine")>=300,"폭파 공작","💣","burn"],
 ["voidReaver","thief","공허 약탈자","🌀",5,"나락 최심부 진입 + 치명 60%",(s,st)=>(s.visits.ab1||0)>=1&&st.crit>=60,"공허 갈퀴","🕳️","critd"],
 ["silencer","thief","침묵자","🤫",4,"누적 3,000마리 처치",(s,st)=>s.killTotal>=3000,"소리 없는 죽음","☠️","gcrit"],
 ["luckyRogue","thief","행운아","🍀",2,"강화 성공 10회 + 사망 3회 이상",(s,st)=>s.enhOk>=10&&s.deaths>=3,"행운의 급소","🎲","exec"],
 ["relicHunter","thief","유물 사냥꾼","🏺",3,"고대 유적 50회 방문",(s,st)=>(s.visits.jg4||0)>=50,"유물의 힘","🗿","buff"],
 ["kingSlayer","thief","왕 시해자","🗡️",5,"티어 7 보스 처치",(s,st)=>Object.keys(s.bossKills).some(k=>k.startsWith("b7")),"왕의 목","👑","exec"],
 ["worldWalker","any","세계 방랑자","🌍",5,"서로 다른 맵 50곳 방문",(s,st)=>Object.keys(s.visits).length>=50,"세계의 걸음","🌏","buff"],
 ["godSlayer","any","신살자","⚡",5,"나락의 신 어비스 처치",(s,st)=>(s.bossKills.b705||0)>=1,"신살","🌩️","critd"],
 ["abyssHeart","any","심연의 심장","🖤",5,"Lv120 도달",(s,st)=>s.lv>=120,"심연 공명","🕳️","shield"],
 ["legendH","any","살아있는 전설","🏆",5,"누적 10,000마리 처치",(s,st)=>s.killTotal>=10000,"전설의 일격","✨","critd"],
 ["collector","any","수집왕","📦",2,"장비 15개 + 룬 20개 보유",(s,st)=>s.inv.length>=15&&s.runes.length>=20,"수집품 투척","🎁","hits3"],
];
const HID_CINE_COL={dragonKnight:"#fb7185",darkMage:"#a78bfa",assassin:"#94a3b8"};
const HPAL=["#f87171","#fb923c","#facc15","#4ade80","#22d3ee","#818cf8","#c084fc","#f472b6","#a3e635","#2dd4bf"];
let _hidx=0;
for(const [id,base,name,icon,t,need,check,sn,si,fk] of HROWS){
  const f=HFX[fk], skid="hs_"+id;
  HID_CINE_COL[id]=HPAL[_hidx++%HPAL.length];
  let mu=+(2.6+0.55*t).toFixed(2); if(f.hits)mu=+(mu*0.5).toFixed(2);
  SKILLS[skid]={name:sn,icon:si,cls:id,lv:20,mp:28+4*t,mult:mu,hits:f.hits||1,fx:f.fx||{},cine:"ultra",
    desc:`[히든] ${Math.round(mu*100)}%${f.hits?" × "+f.hits+"연격":""} 피해 · ${f.d}`};
  HID[id]={name,icon,base,need,check,mult:{atk:+(1.15+0.09*t).toFixed(2),hp:+(1.1+0.06*t).toFixed(2),def:+(1.05+0.05*t).toFixed(2),mp:+(1.05+0.07*t).toFixed(2),critF:2*t-2,critdF:10*t},skill:skid};
}

/* ===================== 스킬 계열 시스템 (직업당 10계열 × 50랭크 = 500스킬) =====================
   각 계열은 아키타입(연격/기절/도트/흡혈/버프/처형...)을 가지며, 랭크업마다 위력이 성장한다.
   저장은 s.skills[계열id]=랭크 로 콤팩트하게, 전투는 현재 랭크의 개별 스킬 엔트리를 사용. */
const ARCH=[
 {k:"strike",mult:1.9,d:"고배율 단일 강타"},
 {k:"swift",mult:.95,hits:2,d:"2연격"},
 {k:"barrage",mult:.8,hits:3,d:"3연격"},
 {k:"crush",mult:1.5,fx:{stun:1},d:"적 1턴 기절"},
 {k:"venom",mult:1.35,fx:{dot:{k:"poison",pct:.5,t:3}},d:"중독 (3턴)"},
 {k:"burn",mult:1.35,fx:{dot:{k:"burn",pct:.5,t:3}},d:"화상 (3턴)"},
 {k:"leech",mult:1.6,fx:{heal:.35},d:"피해의 35% 흡혈"},
 {k:"guard",mult:0,fx:{shield:.3,selfHeal:.15},d:"보호막 + HP 15% 회복"},
 {k:"rally",mult:0,fx:{atkB:{v:.35,t:3}},d:"공격력 +35% (3턴)"},
 {k:"reap",mult:1.7,fx:{exec:{below:.3,mult:2}},d:"적 HP 30% 미만 시 2배"},
];
const FAM_ICONS=["💢","⚡","🌪️","💥","🐍","🔥","🩸","🛡️","📣","☠️"];
const FAM_NAMES={
 warrior:["강격","질풍참","난무참","분쇄격","독아검","작열검","혈검","수호 태세","전의 고양","참수"],
 mage:["비전 화살","쌍둥이 마탄","마력 연사","빙쇄","부식의 안개","겁화구","흡성 마법","마력 장막","비전 증폭","멸절"],
 thief:["급습","쌍검무","삼연섬","마비침","독무","화염병 투척","흡혈흔","연막 수비","살기 개방","급소 절단"],
 knight:["방패 강타","연속 베기","삼단 찌르기","방패 분쇄","녹슨 칼날","성화 낙인","헌신의 흡수","성역 선포","기사도","단죄"],
 monk:["정권 지르기","연환 장타","폭풍 연타","붕권","사혈지","염화장","기력 흡수","철포삼","기공 개방","일격필살"],
 lancer:["관통 찌르기","이단 창격","연속 투창","대지 찍기","독창","화염창","창끝 흡혈","창벽 방어","투지 고양","심장 꿰뚫기"],
 priest:["성스러운 빛","이중 성타","연속 기도","심판의 망치","부패 정화","성화","생명 흡수","축복의 방패","신념 강화","엑소시즘"],
 warlock:["저주 화살","이중 저주","영혼 연타","속박의 저주","맹독 저주","지옥 불꽃","생명력 착취","어둠의 계약","금단 강화","영혼 수확"],
 bard:["불협화음","이중주","삼중주","충격파 연주","독설의 노래","열정의 세레나데","흡수의 선율","방어의 왈츠","용기의 찬가","종막의 악장"],
 summoner:["정령 타격","쌍정령 습격","정령 난무","골렘 강타","독정령 소환","화염정령 소환","정령 흡수","수호 정령","계약 강화","정령왕의 일격"],
 archer:["정조준 사격","더블 샷","트리플 샷","충격 화살","독화살","불화살","흡혈 화살","회피 기동","매의 눈","헤드샷"],
 gunner:["속사","더블 탭","풀 버스트","섬광탄","독탄","소이탄","흡혈탄","엄폐 사격","조준 보정","처형탄"],
 reaper:["낫질","이연 낫질","영혼 삼분","공포의 낫","부패의 낫","지옥 낫","흡혼 낫","죽음의 장막","사신 개방","영혼 심판"],
};
const FAMS={};
for(const cid of Object.keys(CLS)){
  FAM_NAMES[cid].forEach((nm,i)=>{
    const famId="f_"+cid+"_"+i, A=ARCH[i];
    FAMS[famId]={id:famId,cid,idx:i,name:nm,icon:FAM_ICONS[i],arch:A,maxR:50};
    for(let r=1;r<=50;r++){
      const mu=A.mult>0?+(A.mult*(1+0.09*(r-1))).toFixed(2):0;
      SKILLS[famId+"_"+r]={name:nm+" "+r+"식",icon:FAM_ICONS[i],cls:cid,fam:famId,rank:r,
        lv:1+i*2+(r-1)*3, mp:Math.round(8+i+r*1.2), mult:mu, hits:A.hits||1,
        fx:A.fx?JSON.parse(JSON.stringify(A.fx)):{},
        desc:(mu>0?Math.round(mu*100)+"% 피해"+(A.hits?" × "+A.hits+"연격":""):"보조 기술")+" · "+A.d};
    }
  });
}

/* ===================== 전설 스킬 (직업당 5종 · 사용 시 컷씬 발동) ===================== */
const LEG_ROWS={
 warrior:[["운명 절단","🗡️"],["천붕지열","⛰️"],["전신 강림","🔱"],["라그나로크 제로","🌋"],["별을 가르는 자","🌠"]],
 mage:[["시공 붕괴","🌀"],["초신성","💥"],["마나 특이점","🕳️"],["아카식 레코드","📜"],["빅뱅","🌌"]],
 thief:[["그림자 처형식","🌑"],["천 개의 칼날","🗡️"],["절대 암살","☠️"],["시간 도둑","⏳"],["운명 강탈","🎭"]],
 knight:[["불멸의 성벽","🏰"],["신성 심판","⚖️"],["수호신 강림","👼"],["최후의 보루","🛡️"],["여명의 맹세","🌅"]],
 monk:[["백보신권","👊"],["나한신장","🙏"],["천수관음","🕉️"],["파천황","💫"],["무극의 경지","☯️"]],
 lancer:[["용살창","🐉"],["신창 궁니르","⚡"],["천공 낙하","☄️"],["신창 무쌍","🌪️"],["별의 창","🌟"]],
 priest:[["신의 분노","⚡"],["대천사 강림","👼"],["최후의 심판","⚖️"],["성역 해방","✨"],["창세의 빛","🌅"]],
 warlock:[["종말의 저주","💀"],["악마왕 소환","👹"],["영혼 대붕괴","🌑"],["금단의 의식","🩸"],["나락 개방","🕳️"]],
 bard:[["진혼곡","🎼"],["광란의 광시곡","🎻"],["세계수의 노래","🌳"],["신들의 합창","🎶"],["종언의 교향곡","🎹"]],
 summoner:[["정령왕 이프리트","🔥"],["빙제 강림","❄️"],["뇌신 소환","⚡"],["대지모신의 분노","🌍"],["시원의 정령","💠"]],
 archer:[["유성우 사격","🌠"],["신궁의 경지","🎯"],["태양 관통","☀️"],["별자리 사격","✨"],["세계를 꿰뚫는 살","🌌"]],
 gunner:[["탄막 지옥","💣"],["레일건","⚡"],["융단 포화","🔥"],["절대 영점 사격","🎯"],["최종 병기","☢️"]],
 reaper:[["영혼 수확제","💀"],["사신 강림","🌒"],["명계 개방","⚰️"],["윤회 절단","🌀"],["종말의 낫","🕳️"]],
};
const LEG_LV=[50,100,200,350,500], LEG_MULT=[8,16,32,64,128], LEG_MP=[80,160,320,640,1280];
const LEG_FX=[{gcrit:1,critdB:100},{stun:1,dot:{k:"burn",pct:1,t:3}},{heal:.5,selfHeal:.2},{exec:{below:.5,mult:2.5}},{gcrit:1,critdB:200}];
const LEG_FXD=["확정 치명타 + 치피 +100%","기절 + 강력한 화상(3턴)","피해 50% 흡혈 + HP 20% 회복","적 HP 50% 미만 시 2.5배 처형","확정 치명타 + 치피 +200%"];
for(const cid of Object.keys(LEG_ROWS)){
  LEG_ROWS[cid].forEach((row,i)=>{
    SKILLS["leg_"+cid+"_"+i]={name:row[0],icon:row[1],cls:cid,leg:i+1,lv:LEG_LV[i],mp:LEG_MP[i],mult:LEG_MULT[i],hits:1,
      fx:JSON.parse(JSON.stringify(LEG_FX[i])),cine:true,
      desc:`[전설 ${i+1}] ${LEG_MULT[i]*100}% 궁극기 · ${LEG_FXD[i]}`};
  });
}
const CINE_COL={warrior:"#f87171",mage:"#818cf8",thief:"#a3e635",knight:"#fbbf24",monk:"#fb923c",lancer:"#38bdf8",priest:"#fde68a",warlock:"#c084fc",bard:"#f472b6",summoner:"#34d399",archer:"#4ade80",gunner:"#fb7185",reaper:"#a78bfa"};

/* ===================== 몬스터 ===================== */
const MONS={
  slime:{id:"slime",name:"슬라임",icon:"🟢",hp:22,atk:4,def:1,xp:9,gold:6,tier:1},
  rat:{id:"rat",name:"들쥐",icon:"🐀",hp:16,atk:5,def:0,xp:7,gold:5,tier:1},
  goblin:{id:"goblin",name:"고블린",icon:"👺",hp:70,atk:11,def:3,xp:26,gold:16,tier:2},
  gobArcher:{id:"gobArcher",name:"고블린 궁수",icon:"🏹",hp:55,atk:15,def:2,xp:30,gold:20,tier:2},
  wolf:{id:"wolf",name:"회색 늑대",icon:"🐺",hp:90,atk:14,def:4,xp:36,gold:22,tier:2},
  orcGrunt:{id:"orcGrunt",name:"오크 졸병",icon:"🧌",hp:210,atk:26,def:8,xp:90,gold:48,tier:3},
  orcWarrior:{id:"orcWarrior",name:"오크 전사",icon:"🪓",hp:300,atk:33,def:12,xp:130,gold:70,tier:3},
  orcShaman:{id:"orcShaman",name:"오크 주술사",icon:"🔯",hp:240,atk:40,def:8,xp:150,gold:85,tier:3},
  skeleton:{id:"skeleton",name:"스켈레톤",icon:"💀",hp:260,atk:30,def:14,xp:120,gold:60,tier:3,tags:["undead"]},
  zombie:{id:"zombie",name:"좀비",icon:"🧟",hp:420,atk:28,def:10,xp:140,gold:66,tier:3,tags:["undead"]},
  ghost:{id:"ghost",name:"원혼",icon:"👻",hp:230,atk:45,def:6,xp:160,gold:80,tier:3,tags:["undead"]},
  iceGolem:{id:"iceGolem",name:"아이스 골렘",icon:"🧊",hp:900,atk:55,def:28,xp:380,gold:180,tier:4},
  frostWolf:{id:"frostWolf",name:"설원 늑대",icon:"🐺",hp:650,atk:68,def:18,xp:360,gold:170,tier:4},
  frostSpirit:{id:"frostSpirit",name:"서리 정령",icon:"❄️",hp:700,atk:80,def:15,xp:420,gold:210,tier:4},
  dragonWhelp:{id:"dragonWhelp",name:"새끼 화룡",icon:"🐉",hp:1600,atk:95,def:35,xp:900,gold:420,tier:5,tags:["dragon"]},
  lavaSpirit:{id:"lavaSpirit",name:"용암 정령",icon:"🌋",hp:1400,atk:115,def:28,xp:950,gold:460,tier:5},
  drakeWarrior:{id:"drakeWarrior",name:"드레이크 전사",icon:"🦖",hp:2100,atk:110,def:45,xp:1200,gold:560,tier:5,tags:["dragon"]},
};

/* ===================== 맵 (노드형 + 포탈) ===================== */
const MAPS={
  village:{name:"초보자 마을",icon:"🏘️",lv:1,portals:["forest"],mons:["slime","rat"],npc:"촌장 로한: 어서 오게, 모험가여. 고블린 숲의 마수들이 마을을 위협하고 있다네.",boss:null},
  forest:{name:"고블린 숲",icon:"🌲",lv:5,portals:["village","orc","grave"],mons:["goblin","gobArcher","wolf"],npc:"정찰병 리나: 오크 주둔지와 어둠의 묘지로 가는 갈림길이야. 준비는 됐어?",boss:"b103"},
  orc:{name:"오크 주둔지",icon:"⛺",lv:12,portals:["forest","canyon"],mons:["orcGrunt","orcWarrior","orcShaman"],npc:"포로 상인: 살려줘서 고맙네… 오크 로드는 괴물이야. 조심하게.",boss:"b301"},
  grave:{name:"어둠의 묘지",icon:"🪦",lv:15,portals:["forest","canyon"],mons:["skeleton","zombie","ghost"],npc:"수도사 엘렌: 이곳의 언데드를 정화하는 자, 어둠의 힘에 눈뜨리라…",boss:"b302"},
  canyon:{name:"얼어붙은 협곡",icon:"🏔️",lv:22,portals:["orc","grave","nest"],mons:["iceGolem","frostWolf","frostSpirit"],npc:"산악 안내인: 이 협곡 너머가 화룡의 둥지다. 돌아가려면 지금이 마지막 기회야.",boss:"b401"},
  nest:{name:"화룡의 둥지",icon:"🌋",lv:30,portals:["canyon"],mons:["dragonWhelp","lavaSpirit","drakeWarrior"],npc:"용사냥꾼의 유서: …이그니스를 잡는 자, 전설이 되리라.",boss:"b501"},
};

/* ===================== 확장 세계 (신규 몬스터 30종 + 맵 50개 · 10개 지역) =====================
   몬스터 스탯은 맵 레벨 기반 공식 생성 — xp는 needXp 지수 곡선에 맞춰 레벨당 약 1100마리 사냥 밸런스 */
const mkM2=(id,name,icon,L,hpM,atkM,tags)=>{ MONS[id]={id,name,icon,
  hp:Math.round(2.6*L*L*hpM), atk:Math.round(3.2*L*atkM), def:Math.round(0.9*L),
  xp:Math.max(1,Math.round(needXp(L)/1100)), gold:Math.max(30,Math.round(Math.pow(L,2.4)*hpM)),
  tier:L>=60?6:5, tags:tags||[]}; };
/* 지역 1: 모래바람 사막 (Lv32~40) */
mkM2("scorpion","사막 전갈","🦂",36,0.8,1.1,["beast"]);
mkM2("sandGolem","모래 골렘","🗿",36,1.3,0.85,["elemental"]);
mkM2("mummy","미라 전사","⚰️",38,1.0,1.0,["undead"]);
/* 지역 2: 잊혀진 해안 (Lv42~50) */
mkM2("crab","심해 집게","🦀",46,1.25,0.9,["beast"]);
mkM2("siren","세이렌","🧜",46,0.8,1.25,["demon"]);
mkM2("kraken","크라켄 촉수","🐙",48,1.4,1.0,["beast"]);
/* 지역 3: 원시 정글 (Lv52~60) */
mkM2("jaguar","독니 재규어","🐆",56,0.85,1.2,["beast"]);
mkM2("manEater","식인 꽃","🌺",56,1.2,0.95,[]);
mkM2("jungleTroll","정글 트롤","🦍",58,1.35,1.05,["beast"]);
/* 지역 4: 천공 섬 (Lv62~70) */
mkM2("harpy","하피","🦅",66,0.85,1.2,["beast"]);
mkM2("griffin","그리핀","🦁",66,1.15,1.1,["beast"]);
mkM2("stormSpirit","폭풍 정령","🌩️",68,0.95,1.3,["elemental"]);
/* 지역 5: 지저 왕국 (Lv72~80) */
mkM2("caveBrute","동굴 파쇄자","🦴",76,1.3,1.0,["beast"]);
mkM2("crystalGolem","수정 골렘","💎",76,1.45,0.9,["elemental"]);
mkM2("deepDrake","지저 드레이크","🦎",78,1.1,1.15,["dragon"]);
/* 지역 6: 기계 도시 폐허 (Lv82~90) */
mkM2("sentry","고장난 경비병","🤖",86,1.1,1.05,["machine"]);
mkM2("steelSpider","강철 거미","🕸️",86,0.85,1.25,["machine"]);
mkM2("warGolem","전쟁 골렘","⚙️",88,1.5,1.05,["machine"]);
/* 지역 7: 저주받은 빙토 (Lv92~100) */
mkM2("frozenWraith","얼어붙은 망령","🥶",96,0.9,1.25,["undead"]);
mkM2("iceLich","빙결 리치","☃️",96,1.1,1.2,["undead"]);
mkM2("frostDragon","서리 고룡","🐉",98,1.35,1.15,["dragon"]);
/* 지역 8: 화염 심연 (Lv102~110) */
mkM2("hellImp","지옥 임프","😈",106,0.8,1.3,["demon"]);
mkM2("hellKnight","지옥 기사","🏇",106,1.25,1.15,["demon"]);
mkM2("lavaDragon","용암 고룡","🌋",108,1.4,1.2,["dragon"]);
/* 지역 9: 별의 잔해 (Lv112~120) */
mkM2("starSpirit","별빛 정령","✨",116,0.9,1.25,["elemental"]);
mkM2("voidEater","공허 포식자","🌀",116,1.2,1.25,["void"]);
mkM2("meteorGolem","운석 거인","☄️",118,1.5,1.1,["elemental"]);
/* 지역 10: 나락 최심부 (Lv122~130) */
mkM2("abyssWatcher","심연 감시자","🫥",126,1.15,1.3,["void"]);
mkM2("abyssDragon","나락 고룡","🐲",126,1.45,1.25,["dragon","void"]);
mkM2("abyssSpawn","어비스 스폰","👾",128,1.0,1.4,["void","demon"]);

const NEW_REGIONS=[
 {key:"ds",name:"모래바람 사막",lv:32,npc:"사막 안내인: 모래폭풍 너머, 파라오의 저주가 기다린다…",pool:["scorpion","sandGolem","mummy"],
  maps:[["사막 입구","🏜️"],["전갈 둥지","🦂"],["모래폭풍 평원","🌪️"],["신기루 오아시스","💧"],["파라오의 무덤","🪦"]]},
 {key:"co",name:"잊혀진 해안",lv:42,npc:"늙은 뱃사공: 세이렌의 노래를 듣지 마라. 듣는 순간 끝이다.",pool:["crab","siren","kraken"],
  maps:[["난파선 해변","🏖️"],["안개 부두","⚓"],["세이렌 암초","🪸"],["해저 동굴","🌊"],["크라켄의 심연","🐙"]]},
 {key:"jg",name:"원시 정글",lv:52,npc:"탐험가의 일지: 꽃이 웃는 곳에서 뒤를 조심하라.",pool:["jaguar","manEater","jungleTroll"],
  maps:[["정글 초입","🌴"],["덩굴 미로","🌿"],["식인 꽃밭","🌺"],["고대 유적","🛕"],["세계수 뿌리","🌳"]]},
 {key:"sk",name:"천공 섬",lv:62,npc:"바람의 수도승: 추락을 두려워하는 자, 하늘을 걸을 수 없다.",pool:["harpy","griffin","stormSpirit"],
  maps:[["부유 계단","🪜"],["구름 목장","☁️"],["폭풍의 눈","🌩️"],["그리핀 둥지","🪶"],["하늘 신전","⛩️"]]},
 {key:"ug",name:"지저 왕국",lv:72,npc:"눈먼 광부: 수정이 빛나는 곳엔 반드시 지키는 자가 있지.",pool:["caveBrute","crystalGolem","deepDrake"],
  maps:[["무너진 갱도","⛏️"],["발광 버섯 숲","🍄"],["수정 궁전","💎"],["지하 호수","🪨"],["용암 경계","🔥"]]},
 {key:"mc",name:"기계 도시 폐허",lv:82,npc:"고장난 안내 로봇: 어-서 오세요. 침입자. 제-거. 제-거.",pool:["sentry","steelSpider","warGolem"],
  maps:[["녹슨 성문","🚪"],["조립 공장","🏭"],["전력로","⚡"],["병기 창고","🔧"],["중앙 코어","💠"]]},
 {key:"ic",name:"저주받은 빙토",lv:92,npc:"얼어붙은 비석: …여기서부터는 숨결마저 얼어붙는다…",pool:["frozenWraith","iceLich","frostDragon"],
  maps:[["얼어붙은 관문","🚧"],["눈보라 벌판","❄️"],["빙하 무덤","🧊"],["리치의 첨탑","🗼"],["절대영도의 심장","🥶"]]},
 {key:"hf",name:"화염 심연",lv:102,npc:"불타는 두루마리: 재가 되기 전에 돌아가라, 필멸자여.",pool:["hellImp","hellKnight","lavaDragon"],
  maps:[["재의 사막","🌋"],["유황 습지","♨️"],["불의 강","🔥"],["지옥문","😈"],["심장 화구","☀️"]]},
 {key:"st",name:"별의 잔해",lv:112,npc:"별지기: 죽은 별들 사이에서 공허가 눈을 뜬다.",pool:["starSpirit","voidEater","meteorGolem"],
  maps:[["별똥별 평원","🌠"],["무중력 협곡","🌌"],["성운 정원","💫"],["별의 무덤","⭐"],["은하수 끝","🌉"]]},
 {key:"ab",name:"나락 최심부",lv:122,npc:"목소리 없는 속삭임: 이 곳이 심연의 끝… 그리고 시작.",pool:["abyssWatcher","abyssDragon","abyssSpawn"],
  maps:[["어둠의 계단","🕳️"],["침묵의 회랑","🌑"],["공허의 왕좌","👁️"],["종말의 문","🗝️"],["나락의 바닥","🩸"]]},
];
(function(){
  let prevTail="nest";
  for(const rg of NEW_REGIONS){
    rg.maps.forEach((mm,i)=>{
      const id=rg.key+(i+1);
      MAPS[id]={name:mm[0],icon:mm[1],lv:rg.lv+i*2,portals:[],mons:i===0?rg.pool.slice(0,2):rg.pool,npc:rg.npc,boss:null,region:rg.name};
    });
    for(let i=1;i<=5;i++){
      const id=rg.key+i;
      if(i>1)MAPS[id].portals.push(rg.key+(i-1));
      if(i<5)MAPS[id].portals.push(rg.key+(i+1));
    }
    MAPS[rg.key+"1"].portals.unshift(prevTail);
    MAPS[prevTail].portals.push(rg.key+"1");
    prevTail=rg.key+"5";
  }
})();

/* ===================== 월드 2 · 3 (레벨 게이트 세계) =====================
   월드 2: Lv150 입장 · 균열 저편 15맵 / 월드 3: Lv500 입장 · 신들의 영역 15맵 */
mkM2("riftHunter","균열 사냥꾼","🩻",155,0.9,1.2,["void"]);
mkM2("twistGiant","뒤틀린 거인","🗿",160,1.4,1.0,["beast"]);
mkM2("chronoWraith","시간 망령","⏳",165,0.95,1.25,["undead"]);
mkM2("voidStalker","공허 추적자","🐆",205,1.0,1.3,["void","beast"]);
mkM2("warpKnight","왜곡된 기사","🛡️",210,1.3,1.15,["demon"]);
mkM2("chronoGolem","크로노 골렘","⚙️",215,1.5,1.05,["machine","elemental"]);
mkM2("riftDragon","균열 드래곤","🐉",255,1.35,1.25,["dragon","void"]);
mkM2("infWatcher","무한의 감시자","👁️",260,1.1,1.35,["void"]);
mkM2("timeAvatar","시간의 화신","🌀",265,1.2,1.3,["elemental"]);
mkM2("fallenGod","타락한 신장","😇",510,1.2,1.25,["demon"]);
mkM2("godShard","신의 파편","💎",520,1.0,1.35,["elemental"]);
mkM2("primeShadow","태초의 그림자","🌑",530,1.3,1.2,["void"]);
mkM2("genesisDragon","창세의 용","🐲",610,1.45,1.3,["dragon"]);
mkM2("godslayerW","신살 망령","☠️",620,1.1,1.4,["undead","void"]);
mkM2("worldEater","세계 포식자","🌌",630,1.5,1.3,["void","beast"]);
mkM2("infMachine","무한 기계신","🤖",710,1.55,1.25,["machine"]);
mkM2("fateWeaver","운명의 직조자","🕸️",720,1.15,1.45,["elemental"]);
mkM2("primalDark","태초의 어둠","🕳️",730,1.4,1.4,["void","demon"]);

const W2_REGIONS=[
 {key:"r2a",name:"균열 평원",lv:150,step:10,npc:"",pool:["riftHunter","twistGiant","chronoWraith"],
  maps:[["균열 관문","🌀"],["부서진 하늘 아래","🌩️"],["떠도는 섬","🏝️"],["왜곡의 골짜기","🌫️"],["시간이 멈춘 마을","🕰️"]]},
 {key:"r2b",name:"뒤틀린 왕국",lv:200,step:10,npc:"",pool:["voidStalker","warpKnight","chronoGolem"],
  maps:[["거꾸로 선 성문","🏰"],["뒤틀린 왕좌","👑"],["무너진 대성당","⛪"],["기괴한 정원","🥀"],["왕의 무덤","⚰️"]]},
 {key:"r2c",name:"시간의 폐허",lv:250,step:10,npc:"",pool:["riftDragon","infWatcher","timeAvatar"],
  maps:[["모래시계 사막","⌛"],["역행의 강","🏞️"],["멈춘 번개","⚡"],["영원의 도서관","📚"],["차원의 심장","💠"]]},
];
const W3_REGIONS=[
 {key:"r3a",name:"신들의 무덤",lv:500,step:20,npc:"",pool:["fallenGod","godShard","primeShadow"],
  maps:[["신역의 문","⛩️"],["거신의 유해","🦴"],["신성 잃은 제단","🕯️"],["황혼의 옥좌","🌇"],["침묵하는 신전","🛕"]]},
 {key:"r3b",name:"무한 회랑",lv:600,step:20,npc:"",pool:["genesisDragon","godslayerW","worldEater"],
  maps:[["끝없는 계단","🪜"],["뒤집힌 탑","🗼"],["무한의 거울","🪞"],["별들의 회랑","🌌"],["운명의 교차점","✖️"]]},
 {key:"r3c",name:"태초의 심연",lv:700,step:20,npc:"",pool:["infMachine","fateWeaver","primalDark"],
  maps:[["창세의 잔해","🌋"],["무(無)의 해안","🌊"],["시원의 어둠","🌑"],["마지막 별빛","🌟"],["태초, 그 자체","⚫"]]},
];
function wireRegions(regions,firstTail,w){
  let prevTail=firstTail;
  for(const rg of regions){
    rg.maps.forEach((mm,i)=>{
      const id=rg.key+(i+1);
      MAPS[id]={name:mm[0],icon:mm[1],lv:rg.lv+i*rg.step,portals:[],mons:i===0?rg.pool.slice(0,2):rg.pool,npc:rg.npc,boss:null,region:rg.name,w};
    });
    for(let i=1;i<=5;i++){ const id=rg.key+i;
      if(i>1)MAPS[id].portals.push(rg.key+(i-1));
      if(i<5)MAPS[id].portals.push(rg.key+(i+1)); }
    if(prevTail){ MAPS[rg.key+"1"].portals.unshift(prevTail); MAPS[prevTail].portals.push(rg.key+"1"); }
    prevTail=rg.key+"5";
  }
}
wireRegions(W2_REGIONS,null,2);
wireRegions(W3_REGIONS,null,3);
const WORLDS=[
 {w:1,name:"제1세계 · 필멸의 대륙",icon:"🌍",lv:1,start:"village",desc:"모험이 시작되는 땅. 초보자 마을부터 나락 최심부까지 56개 지역."},
 {w:2,name:"제2세계 · 균열의 저편",icon:"🌌",lv:150,start:"r2a1",desc:"차원 균열 너머의 뒤틀린 세계. 시간과 공간이 무너진 15개 지역."},
 {w:3,name:"제3세계 · 신들의 영역",icon:"👑",lv:500,start:"r3a1",desc:"신조차 잠든 태초의 영역. 필멸자가 닿는 마지막 15개 지역."},
];

/* ===================== NPC (모든 맵 2~3명 · 대화 시스템) ===================== */
const NPC_ARCH=[
 ["안내인","🧭",["{m}에 온 것을 환영하네, 모험가.","여기서 무리하면 목숨을 잃어. 권장 레벨은 지키게.","포탈은 언제나 열려 있네. 위험하면 돌아가게."]],
 ["상인","💰",["싸게 드릴게! ...농담이야, 제값은 받아야지.","{m} 특산품? 그런 건 없어. 몬스터뿐이지.","입장권은 던전·보스 탭에서 살 수 있다네."]],
 ["떠돌이 음유시인","🎻",["{m}의 전설을 노래로 만들고 있어. 아직 1절뿐이지만.","히든 직업이 56종이 넘는다더군. 조건은... 노래에 안 나와.","영웅이 되면 자네 노래도 만들어 주지."]],
 ["수상한 노인","🧙",["...{m}의 깊은 곳엔 비밀이 잠들어 있지.","기행을 저지르는 자에게 숨겨진 길이 열린다네.","전설 스킬의 컷씬을 본 적 있나? 하늘이 갈라지지."]],
 ["지친 병사","💂",["여긴 {m}... 경계 근무 중이다.","레이드 보스는 혼자 가지 마라. 광장에서 파티를 모아라.","장비 강화는 +5부터 손상될 수 있다. 조심해라."]],
 ["연금술사","⚗️",["{m}의 재료로 뭔가 만들 수 있을 것 같은데...","같은 룬 두 개를 합치면 등급이 오른다는 건 알지?","실패는 성공의 어머니... 강화창 앞에서 늘 되뇌지."]],
 ["방랑 사냥꾼","🏹",["{m}의 사냥감은 내 구역이야. ...농담, 같이 잡자고.","몬스터 태그를 노려봐. 히든 전직 조건과 이어져 있어.","야수든 드래곤이든, 오래 쫓다 보면 길이 보이지."]],
 ["떠돌이 수도사","🙏",["{m}에도 자비가... 아니, 몬스터뿐이군.","죽음을 두려워 말게. 잃는 건 골드 5%뿐이니.","여관에서 쉬면 몸도 기록도 온전해진다네."]],
 ["호기심 많은 아이","🧒",["와! 모험가다! {m}까지 어떻게 왔어요?","나도 크면 전설 스킬 쓸 거예요! 컷씬 완전 멋져요!","엄마가 그러는데 파티 레이드 보스는 진짜 엄청 세대요."]],
 ["정체불명의 유령","👻",["...{m}에서 스러진 자다... 나처럼 되지 마라...","...혼자서는... 레이드를 이길 수 없다...","...제3세계의 신들은... 아직 잠들어 있을 뿐..."]],
];
const NPC_NAMES=["로안","셀린","바트","무명","그레타","일리아","돌프","한나","키요","모스","레브","윤","아릭","페트라","솔","브람"];
const NPCS={};
(function(){
  const hashStr=t=>{ let h=0; for(let i=0;i<t.length;i++)h=(h*31+t.charCodeAt(i))|0; return Math.abs(h); };
  for(const [mid,m] of Object.entries(MAPS)){
    const h=hashStr(mid), n=2+(h%2), list=[];
    for(let k=0;k<n;k++){
      const a=NPC_ARCH[(h+k*3)%NPC_ARCH.length];
      const nm=NPC_NAMES[(h+k*7+m.name.length)%NPC_NAMES.length];
      list.push({name:a[0]+" "+nm,icon:a[1],lines:a[2].map(L=>L.replace("{m}",m.name))});
    }
    NPCS[mid]=list;
  }
})();

/* ===================== 파티 레이드 보스 (P2P 협동 · 초고난도) ===================== */
const RAIDS=[
 {id:"rd1",name:"세계수를 삼킨 자, 이몰그",icon:"🌳",lv:30,rounds:30,d:"뿌리째 삼켜진 세계수의 원혼. 파티의 첫 시험대."},
 {id:"rd2",name:"강철의 재앙, 아크메카",icon:"🤖",lv:80,rounds:30,d:"버려진 기계 도시가 낳은 최후의 병기."},
 {id:"rd3",name:"심연의 폭군, 아자토스",icon:"👁️",lv:130,rounds:32,d:"나락 그 아래에서 올라온 눈뜬 악몽."},
 {id:"rd4",name:"차원을 삼키는 자, 볼가로스",icon:"🌌",lv:220,rounds:34,d:"제2세계의 균열을 만든 장본인."},
 {id:"rd5",name:"태초의 어둠, 니힐",icon:"🕳️",lv:550,rounds:36,d:"창세 이전부터 존재한 무(無). 최후의 레이드."},
].map(r=>({...r,hp:Math.round(2.6*r.lv*r.lv*2.5),atk:Math.round(3.2*r.lv*0.7),def:Math.round(0.9*r.lv*1.2)}));
const RAID_MAP={}; RAIDS.forEach(r=>RAID_MAP[r.id]=r);

/* ===================== 보스 (35종 · 7티어 · 기믹) ===================== */
const MECH={
  enrage:{n:"격노",icon:"😡",d:"HP 40% 이하일 때 공격력 +50%"},
  regen:{n:"재생",icon:"💚",d:"매 턴 최대 HP의 3% 회복"},
  double:{n:"연격",icon:"⚡",d:"한 턴에 2회 공격"},
  burn:{n:"작열",icon:"🔥",d:"35% 확률로 화상 부여 (3턴 지속피해)"},
  poison:{n:"맹독",icon:"☠️",d:"35% 확률로 중독 부여 (3턴 지속피해)"},
  shieldp:{n:"수호막",icon:"🛡️",d:"HP 60% 도달 시 보호막 생성 (1회)"},
  lifesteal:{n:"흡혈",icon:"🩸",d:"가한 피해의 30% 회복"},
  crush:{n:"분쇄",icon:"🔨",d:"아군 방어력 50% 무시"},
  stunp:{n:"강타",icon:"💫",d:"20% 확률로 충격 — 아군 다음 공격 위력 -50%"},
};
const BT={1:{hp:2200,atk:24,def:6,turns:26,lvq:1},2:{hp:6500,atk:46,def:13,turns:28,lvq:8},
  3:{hp:16000,atk:76,def:21,turns:30,lvq:15},4:{hp:36000,atk:118,def:38,turns:32,lvq:23},
  5:{hp:85000,atk:180,def:60,turns:36,lvq:30},6:{hp:190000,atk:265,def:90,turns:40,lvq:38},
  7:{hp:420000,atk:390,def:135,turns:45,lvq:46}};
const mkB=(id,name,icon,tier,hpM,mech,tags)=>{const b=BT[tier];const hp=Math.round(b.hp*hpM);
  return{id,name,icon,tier,hp,atk:Math.round(b.atk*(0.88+hpM*0.12)),def:b.def,turns:b.turns,lvq:b.lvq,
    xp:Math.round(hp/5),gold:Math.round(hp/9),mech:mech||[],tags:tags||[]};};
const BOSS_LIST=[
  /* T1 */
  mkB("b101","슬라임 킹","👑",1,1,[]),
  mkB("b102","거대 들쥐 라투스","🐀",1,.85,["double"]),
  mkB("b103","고블린 킹","👹",1,1.1,["enrage"]),
  mkB("b104","광폭 멧돼지","🐗",1,.95,["crush"]),
  mkB("b105","도적단 두목 베인","🗡️",1,1.05,["stunp"]),
  /* T2 */
  mkB("b201","늑대 우두머리 팽","🐺",2,1,["double"]),
  mkB("b202","고블린 샤먼로드","🔮",2,.9,["burn"]),
  mkB("b203","트롤 파쇄자","🪨",2,1.2,["regen","crush"]),
  mkB("b204","거미 여왕 아라크네","🕷️",2,.95,["poison"]),
  mkB("b205","숲의 폭군 엔트","🌳",2,1.15,["regen"]),
  /* T3 */
  mkB("b301","오크 로드","🗿",3,1,["enrage","crush"]),
  mkB("b302","리치 하르가스","☠️",3,1.05,["lifesteal"],["undead"]),
  mkB("b303","해골 기사단장","⚔️",3,.95,["double"],["undead"]),
  mkB("b304","늪의 히드라","🐍",3,1.2,["regen","poison"]),
  mkB("b305","망령 군주","👻",3,.9,["lifesteal","stunp"],["undead"]),
  /* T4 */
  mkB("b401","프로스트 자이언트","🗻",4,1,["crush","stunp"]),
  mkB("b402","얼음 마녀 시렌","🧙",4,.9,["shieldp","burn"]),
  mkB("b403","빙하 골렘","🧊",4,1.25,["shieldp","regen"]),
  mkB("b404","설산의 예티","🦍",4,1.1,["enrage","double"]),
  mkB("b405","서리 와이번","🐉",4,.95,["double"],["dragon"]),
  /* T5 */
  mkB("b501","화룡 이그니스","🔥",5,1.05,["burn","enrage"],["dragon"]),
  mkB("b502","용암 거인 마그마르","🌋",5,1.2,["burn","crush"]),
  mkB("b503","불사조 피닉스","🐦‍🔥",5,.9,["regen","burn"]),
  mkB("b504","지옥견 케르베로스","🐕",5,1,["double","enrage"]),
  mkB("b505","화염 군주 이프리트","😈",5,1.1,["burn","shieldp"]),
  /* T6 */
  mkB("b601","심연의 감시자","👁️",6,1,["stunp","lifesteal"]),
  mkB("b602","공허 드래곤 니드호그","🐲",6,1.15,["double","crush"],["dragon"]),
  mkB("b603","타락 대천사 루시엘","😇",6,.95,["shieldp","regen"]),
  mkB("b604","그림자 군주 녹스","🌑",6,1.05,["lifesteal","poison"]),
  mkB("b605","종말의 기사","🐎",6,1.1,["enrage","stunp"]),
  /* T7 */
  mkB("b701","태초의 용 바하무트","🐉",7,1.1,["double","burn","enrage"],["dragon"]),
  mkB("b702","죽음 그 자체, 타나토스","💀",7,1,["lifesteal","crush"],["undead"]),
  mkB("b703","별을 삼킨 자","⭐",7,1.2,["shieldp","regen"]),
  mkB("b704","시간의 지배자 크로노스","⏳",7,.95,["double","stunp"]),
  mkB("b705","나락의 신 어비스","🕳️",7,1.3,["enrage","lifesteal","crush"]),
];
const BOSSES={}; BOSS_LIST.forEach(b=>BOSSES[b.id]=b);
const BOSS_ITEM_T=[0,1,2,3,4,5,6,6];

/* ===================== 던전 (30종 · 6티어 · 수식어) ===================== */
const MODS={
  none:{n:"표준",icon:"⬜",d:"기본 규칙의 던전"},
  poison:{n:"독안개",icon:"🟣",d:"매 턴 최대 HP의 2% 피해를 입음"},
  berserk:{n:"광폭화",icon:"🔴",d:"몬스터 공격력 +40%"},
  iron:{n:"강철화",icon:"⚙️",d:"몬스터 방어력 +60%"},
  gold:{n:"황금",icon:"🟡",d:"처치 골드 2배"},
  xp:{n:"수련",icon:"🔵",d:"처치 경험치 1.7배"},
  noheal:{n:"저주",icon:"🖤",d:"처치 시 HP/MP 회복 없음"},
  swarm:{n:"물량",icon:"🟠",d:"웨이브 7개 (보상 +30%)"},
  elite:{n:"정예",icon:"🟪",d:"몬스터 HP +80%, 룬 보상 등급 +1"},
  thorn:{n:"가시",icon:"🌵",d:"가한 피해의 12%를 반사당함"},
  rich:{n:"보물",icon:"💎",d:"클리어 보상 1.8배"},
  dark:{n:"암흑",icon:"🌑",d:"치명타 봉인 (확정 치명타 제외)"},
};
const DG_LV=[0,1,6,13,22,30,40];
const DG_POOL={1:["slime","rat"],2:["goblin","gobArcher","wolf"],3:["orcGrunt","orcWarrior","orcShaman","skeleton","zombie","ghost"],
  4:["iceGolem","frostWolf","frostSpirit"],5:["dragonWhelp","lavaSpirit","drakeWarrior"],6:["dragonWhelp","lavaSpirit","drakeWarrior"]};
const DG_MUL=[0,1,1,1,1,1,2.15];
const mkD=(id,n,i,t,mod)=>({id,n,i,t,mod,lvq:DG_LV[t]});
const DGS=[
  mkD("d101","슬라임 소굴","🟢",1,"none"),   mkD("d102","쥐떼 하수도","🐀",1,"swarm"),
  mkD("d103","버섯 포자 동굴","🍄",1,"poison"),mkD("d104","도적의 은신처","🗡️",1,"gold"),
  mkD("d105","초심자의 시험장","🎯",1,"xp"),
  mkD("d201","고블린 광산","⛏️",2,"none"),   mkD("d202","늑대 둥지","🐺",2,"berserk"),
  mkD("d203","가시덤불 미로","🌵",2,"thorn"), mkD("d204","폐허가 된 병영","🏚️",2,"iron"),
  mkD("d205","황금 개미굴","🐜",2,"gold"),
  mkD("d301","오크 투기장","🏟️",3,"berserk"),mkD("d302","유령 저택","🏰",3,"dark"),
  mkD("d303","지하 납골당","⚱️",3,"swarm"),  mkD("d304","독안개 늪지","🐸",3,"poison"),
  mkD("d305","버려진 보물 금고","💰",3,"rich"),
  mkD("d401","얼음 결정 동굴","❄️",4,"iron"),mkD("d402","눈보라 협로","🌨️",4,"berserk"),
  mkD("d403","서리 제단","🧊",4,"elite"),    mkD("d404","크리스탈 광산","💎",4,"gold"),
  mkD("d405","냉기의 심장","🫀",4,"noheal"),
  mkD("d501","용암 지대","🌋",5,"poison"),   mkD("d502","화산 심장부","❤️‍🔥",5,"elite"),
  mkD("d503","재의 사원","🛕",5,"dark"),     mkD("d504","용의 보고","🐲",5,"rich"),
  mkD("d505","지옥문 앞마당","👿",5,"swarm"),
  mkD("d601","심연의 회랑","🌀",6,"noheal"), mkD("d602","나락의 밑바닥","🕳️",6,"berserk"),
  mkD("d603","공허의 틈","🌌",6,"dark"),     mkD("d604","별이 죽는 곳","💫",6,"elite"),
  mkD("d605","종말의 성소","⛩️",6,"swarm"),
];
const DG_MAP={}; DGS.forEach(d=>DG_MAP[d.id]=d);

/* ===================== 장비 ===================== */
const ITEMS={
  w1:{slot:"weapon",name:"낡은 검",icon:"🗡️",tier:1,atk:6},
  w2:{slot:"weapon",name:"청동 검",icon:"⚔️",tier:2,atk:15},
  w3:{slot:"weapon",name:"강철 대검",icon:"🔪",tier:3,atk:30},
  w4:{slot:"weapon",name:"미스릴 블레이드",icon:"✨",tier:4,atk:56},
  w5:{slot:"weapon",name:"용살자 대검",icon:"🌟",tier:5,atk:100,critd:30},
  w6:{slot:"weapon",name:"신룡의 파멸검",icon:"🌠",tier:6,atk:185,critd:45},
  a1:{slot:"armor",name:"천 갑옷",icon:"👕",tier:1,def:4,hp:25},
  a2:{slot:"armor",name:"가죽 갑옷",icon:"🦺",tier:2,def:11,hp:60},
  a3:{slot:"armor",name:"사슬 갑옷",icon:"⛓️",tier:3,def:22,hp:130},
  a4:{slot:"armor",name:"미스릴 갑옷",icon:"🥋",tier:4,def:40,hp:270},
  a5:{slot:"armor",name:"용비늘 갑옷",icon:"🐲",tier:5,def:75,hp:560},
  a6:{slot:"armor",name:"태초의 신갑",icon:"🌌",tier:6,def:135,hp:1050},
  c1:{slot:"acc",name:"나무 목걸이",icon:"📿",tier:1,crit:2,critd:10},
  c2:{slot:"acc",name:"은 반지",icon:"💍",tier:2,crit:4,critd:20,mp:30},
  c3:{slot:"acc",name:"마력의 부적",icon:"🧿",tier:3,crit:6,critd:35,mp:70},
  c4:{slot:"acc",name:"용안 펜던트",icon:"🔱",tier:4,crit:9,critd:60,atk:15},
  c5:{slot:"acc",name:"이그니스의 심장",icon:"❤️‍🔥",tier:5,crit:14,critd:100,atk:25,hp:200},
  c6:{slot:"acc",name:"어비스의 눈",icon:"🧿",tier:6,crit:20,critd:160,atk:45,hp:380},
  sh1:{slot:"shoes",name:"짚신",icon:"🩴",tier:1,def:2,hp:15,crit:1},
  sh2:{slot:"shoes",name:"가죽 장화",icon:"👢",tier:2,def:6,hp:40,crit:2},
  sh3:{slot:"shoes",name:"강철 각반",icon:"🥾",tier:3,def:13,hp:90,crit:4},
  sh4:{slot:"shoes",name:"미스릴 부츠",icon:"👟",tier:4,def:24,hp:190,crit:6},
  sh5:{slot:"shoes",name:"용린 각화",icon:"🐾",tier:5,def:45,hp:390,crit:9},
  sh6:{slot:"shoes",name:"허공답보의 신","icon":"☁️",tier:6,def:82,hp:740,crit:14},
  af1:{slot:"artifact",name:"이 빠진 토템",icon:"🪵",tier:1,atk:4,mp:15},
  af2:{slot:"artifact",name:"수정 구슬",icon:"🔮",tier:2,atk:10,mp:40},
  af3:{slot:"artifact",name:"고대 룬석",icon:"🪨",tier:3,atk:20,mp:90,critd:15},
  af4:{slot:"artifact",name:"현자의 돌",icon:"💠",tier:4,atk:38,mp:180,critd:30},
  af5:{slot:"artifact",name:"용왕의 여의주",icon:"🔥",tier:5,atk:70,mp:360,critd:55,hp:150},
  af6:{slot:"artifact",name:"태초의 성배",icon:"🏆",tier:6,atk:128,mp:680,critd:90,hp:300},
};
const TIER_POOL={1:["w1","a1","c1","sh1","af1"],2:["w2","a2","c2","sh2","af2"],3:["w3","a3","c3","sh3","af3"],
  4:["w4","a4","c4","sh4","af4"],5:["w5","a5","c5","sh5","af5"],6:["w6","a6","c6","sh6","af6"]};
const TIER_NAME=["","일반","고급","희귀","영웅","전설","신화"];
const TIER_COL=["","#9ca3af","#4ade80","#60a5fa","#c084fc","#fb923c","#f43f5e"];
const SLOT_NAME={weapon:"무기",armor:"갑옷",shoes:"신발",acc:"장신구",artifact:"아티팩트"};
const SLOTS=["weapon","armor","shoes","acc","artifact"];

/* ===================== 룬 ===================== */
const RUNE_T={
  atk:{name:"공격의 룬",icon:"⚔️",stat:"공격력",v:g=>Math.round(6*Math.pow(g,1.7))},
  hp:{name:"생명의 룬",icon:"❤️",stat:"체력",v:g=>Math.round(40*Math.pow(g,1.7))},
  mp:{name:"마력의 룬",icon:"💧",stat:"마력",v:g=>Math.round(18*Math.pow(g,1.7))},
  def:{name:"수호의 룬",icon:"🛡️",stat:"방어력",v:g=>Math.round(4*Math.pow(g,1.7))},
  crit:{name:"치명의 룬",icon:"🎯",stat:"치명타%",v:g=>+(1.2*g).toFixed(1)},
  critd:{name:"파괴의 룬",icon:"💥",stat:"치명피해%",v:g=>6*g},
};
const GRADE=["","하급","중급","상급","최상급","영웅","전설"];
const GRADE_COL=["","#9ca3af","#4ade80","#60a5fa","#c084fc","#fb923c","#f87171"];

/* ===================== 퀘스트 ===================== */
const QUESTS=[
  {id:"q1",name:"슬라임 퇴치",desc:"슬라임 10마리 처치",type:"kill",target:"slime",n:10,rw:{gold:120,xp:60},repeat:true},
  {id:"q2",name:"숲의 정화",desc:"고블린 15마리 처치",type:"kill",target:"goblin",n:15,rw:{gold:350,xp:280,stone:2},repeat:true},
  {id:"q3",name:"늑대 사냥꾼",desc:"회색 늑대 10마리 처치",type:"kill",target:"wolf",n:10,rw:{gold:300,xp:260,stone:1},repeat:true},
  {id:"q4",name:"오크 토벌령",desc:"오크 전사 15마리 처치",type:"kill",target:"orcWarrior",n:15,rw:{gold:900,xp:1200,stone:3},repeat:true},
  {id:"q5",name:"언데드 정화 의식",desc:"언데드 계열 30마리 처치",type:"ktag",target:"undead",n:30,rw:{gold:1600,xp:2400,stone:4},repeat:true},
  {id:"q6",name:"용사냥의 서막",desc:"드래곤류 20마리 처치",type:"ktag",target:"dragon",n:20,rw:{gold:5000,xp:9000,stone:8},repeat:true},
  {id:"q7",name:"성장의 증명 I",desc:"레벨 10 달성",type:"level",n:10,rw:{gold:500,stone:3},repeat:false},
  {id:"q8",name:"성장의 증명 II",desc:"레벨 20 달성",type:"level",n:20,rw:{gold:2000,stone:6},repeat:false},
  {id:"q9",name:"첫 담금질",desc:"장비 강화 1회 성공",type:"enh",n:1,rw:{gold:300,stone:2},repeat:false},
  {id:"q10",name:"룬의 이해",desc:"룬 합성 1회 수행",type:"fuse",n:1,rw:{gold:400,stone:2},repeat:false},
];
const HIDQ=[
  {id:"h1",name:"방랑자의 발걸음",cond:"한 맵을 50번 방문했다",check:s=>Object.values(s.visits).some(v=>v>=50),rw:{gold:5000,stone:10}},
  {id:"h2",name:"대장장이의 눈물",cond:"강화에 3연속 실패했다",check:s=>s.failStreak>=3,rw:{stone:15}},
  {id:"h3",name:"여관의 단골",cond:"여관에서 10번 휴식했다",check:s=>s.innCount>=10,rw:{gold:2500,rune:{t:"hp",g:4}}},
  {id:"h4",name:"불굴의 영혼",cond:"5번 사망하고도 포기하지 않았다",check:s=>s.deaths>=5,rw:{gold:1000,skp:3}},
];
/* ----- 히든 퀘스트 확장 (총 54종) — 기행·수집·도전 조건으로 발견하는 비밀 보상 ----- */
const HQROWS=[
 ["첫 백정","누적 100마리 처치",s=>s.killTotal>=100,{gold:800,stone:3}],
 ["천의 학살자","누적 1,000마리 처치",s=>s.killTotal>=1000,{gold:8000,stone:12,skp:2}],
 ["오천의 도살자","누적 5,000마리 처치",s=>s.killTotal>=5000,{gold:80000,stone:30,skp:5}],
 ["만물의 종결자","누적 20,000마리 처치",s=>s.killTotal>=20000,{gold:2e6,stone:80,skp:10}],
 ["슬라임의 원한","슬라임만 300마리 처치",s=>(s.kills.slime||0)>=300,{gold:3000,rune:{t:"hp",g:3}}],
 ["쥐잡이 명인","들쥐 200마리 처치",s=>(s.kills.rat||0)>=200,{gold:2000,stone:5}],
 ["고블린의 악몽","고블린류 400마리 처치",s=>((s.kills.goblin||0)+(s.kills.gobArcher||0))>=400,{gold:6000,stone:8}],
 ["늑대 사냥의 왕","늑대류 300마리 처치",s=>((s.kills.wolf||0)+(s.kills.frostWolf||0))>=300,{gold:7000,rune:{t:"atk",g:4}}],
 ["망자의 심판자","언데드 500마리 처치",s=>(s.tagKills.undead||0)>=500,{gold:20000,rune:{t:"critd",g:5}}],
 ["용의 재앙","드래곤류 500마리 처치",s=>(s.tagKills.dragon||0)>=500,{gold:50000,rune:{t:"atk",g:5},skp:3}],
 ["야수의 지배자","야수류 500마리 처치",s=>(s.tagKills.beast||0)>=500,{gold:30000,stone:20}],
 ["기계 파괴자","기계류 500마리 처치",s=>(s.tagKills.machine||0)>=500,{gold:60000,stone:25}],
 ["악마 심문관","악마류 500마리 처치",s=>(s.tagKills.demon||0)>=500,{gold:80000,rune:{t:"crit",g:5}}],
 ["공허를 삼킨 자","공허류 500마리 처치",s=>(s.tagKills.void||0)>=500,{gold:150000,rune:{t:"critd",g:6},skp:5}],
 ["정령의 친구","정령류 300마리 처치",s=>(s.tagKills.elemental||0)>=300,{gold:40000,rune:{t:"mp",g:5}}],
 ["부자의 길","골드 5만 보유",s=>s.gold>=50000,{stone:15,dkey:2}],
 ["백만장자","골드 100만 보유",s=>s.gold>=1e6,{stone:40,rticket:3}],
 ["억만장자","골드 1억 보유",s=>s.gold>=1e8,{stone:100,skp:8}],
 ["광부의 집념","강화석 100개 보유",s=>s.stone>=100,{gold:20000,dkey:3}],
 ["열쇠 수집가","던전 입장권 10장 보유",s=>s.dkey>=10,{gold:5000,rticket:2}],
 ["강화의 달인","강화 성공 50회",s=>s.enhOk>=50,{gold:30000,stone:25}],
 ["+10의 경지","장비를 +10까지 강화",s=>{const all=[s.equip.weapon,s.equip.armor,s.equip.acc,...s.inv];return all.some(it=>it&&it.plus>=10);},{gold:50000,stone:30,skp:3}],
 ["실패는 성공의 어머니","강화 5연속 실패",s=>s.failStreak>=5,{stone:40}],
 ["룬 연금술사","룬 합성 30회",s=>s.fuseCount>=30,{gold:25000,rune:{t:"def",g:5}}],
 ["룬 수집광","룬 30개 보유",s=>s.runes.length>=30,{gold:15000,stone:15}],
 ["전설의 룬장인","전설 등급 룬 5개 보유",s=>s.runes.filter(r=>r.g>=6).length>=5,{gold:200000,skp:6}],
 ["장비 창고","인벤토리에 장비 20개 보관",s=>s.inv.length>=20,{gold:10000,stone:10}],
 ["던전 정복자","던전 누적 10회 클리어",s=>Object.values(s.dgClears||{}).reduce((a,b)=>a+b,0)>=10,{gold:12000,dkey:5}],
 ["던전의 지배자","던전 누적 50회 클리어",s=>Object.values(s.dgClears||{}).reduce((a,b)=>a+b,0)>=50,{gold:100000,dkey:10,skp:4}],
 ["모든 규칙의 정복자","서로 다른 던전 15종 클리어",s=>Object.keys(s.dgClears||{}).length>=15,{gold:150000,stone:50}],
 ["보스 헌터","보스 누적 5회 처치",s=>Object.values(s.bossKills||{}).reduce((a,b)=>a+b,0)>=5,{gold:20000,rticket:3}],
 ["보스 학살자","보스 누적 30회 처치",s=>Object.values(s.bossKills||{}).reduce((a,b)=>a+b,0)>=30,{gold:200000,rticket:8}],
 ["도감 완성의 길","서로 다른 보스 15종 처치",s=>Object.keys(s.bossKills||{}).length>=15,{gold:120000,skp:5}],
 ["신을 벤 자","티어 7 보스 3종 처치",s=>Object.keys(s.bossKills||{}).filter(k=>k.startsWith("b7")).length>=3,{gold:1e6,rune:{t:"atk",g:6},skp:10}],
 ["결투 입문","PvP 첫 승리",s=>s.pvpW>=1,{gold:5000,stone:5}],
 ["결투의 왕","PvP 15승",s=>s.pvpW>=15,{gold:100000,skp:5}],
 ["패배는 스승","PvP 10패",s=>s.pvpL>=10,{gold:20000,stone:15}],
 ["수다쟁이","(광장에서 사람들과 어울린 흔적) PvP 3전 이상",s=>(s.pvpW+s.pvpL)>=3,{gold:8000}],
 ["기부 천사","월드 퀘스트에 5,000G 이상 기부",s=>s.world.donated>=5000,{stone:25,skp:2}],
 ["퀘스트 중독자","퀘스트 누적 20회 완료",s=>Object.values(s.questsDone||{}).reduce((a,b)=>a+b,0)>=20,{gold:15000,stone:12}],
 ["퀘스트의 노예","퀘스트 누적 100회 완료",s=>Object.values(s.questsDone||{}).reduce((a,b)=>a+b,0)>=100,{gold:300000,skp:8}],
 ["여관 죽돌이","여관 휴식 50회",s=>s.innCount>=50,{gold:30000,rune:{t:"hp",g:5}}],
 ["잠이 보약","여관 휴식 100회",s=>s.innCount>=100,{gold:100000,skp:4}],
 ["구르고 또 구르고","사망 15회",s=>s.deaths>=15,{gold:30000,skp:5}],
 ["사막의 발견자","모래바람 사막 진입",s=>(s.visits.ds1||0)>=1,{gold:5000,dkey:2}],
 ["바다 내음","잊혀진 해안 진입",s=>(s.visits.co1||0)>=1,{gold:10000,stone:10}],
 ["하늘 위의 첫걸음","천공 섬 진입",s=>(s.visits.sk1||0)>=1,{gold:30000,rune:{t:"crit",g:4}}],
 ["기계 도시의 침입자","기계 도시 폐허 진입",s=>(s.visits.mc1||0)>=1,{gold:80000,stone:30}],
 ["나락을 마주한 자","나락 최심부 진입",s=>(s.visits.ab1||0)>=1,{gold:500000,rune:{t:"atk",g:6},skp:6}],
 ["세계일주","서로 다른 맵 45곳 방문",s=>Object.keys(s.visits).length>=45,{gold:300000,stone:60,skp:6}],
];
HQROWS.forEach((r,i)=>HIDQ.push({id:"hq"+(i+5),name:r[0],cond:r[1],check:r[2],rw:r[3]}));

/* ===================== 저장 ===================== */
function mkSave(nick,pwh,cls){
  return {ver:1,nick,pwh,cls,hcls:null,promoReady:false,promoAvail:[],lv:1,xp:0,sp:0,skp:1,
    alloc:{hp:0,mp:0,atk:0,def:0,crit:0,critd:0},
    hp:1,mp:1,gold:250,stone:5,dkey:1,rticket:0,
    map:"village",mode:"hunt",lastMon:{},
    equip:{weapon:{uid:"i0",t:"w1",plus:0,dmg:false},armor:null,acc:null,shoes:null,artifact:null},
    inv:[],runes:[],runeEq:[null,null,null,null],
    skills:{},autoSkill:null,_auto:false,loadout:[],
    kills:{},tagKills:{},killTotal:0,
    visits:{village:1},deaths:0,innCount:0,failStreak:0,enhOk:0,fuseCount:0,
    quests:{},questsDone:{},hiddenClaimed:{},hiddenFound:{},
    world:{prog:0,donated:0,goal:10000,done:false},
    dgClears:{},bossKills:{},pvpW:0,pvpL:0,
    combat:{mon:null,stun:false,buffs:[],shield:0,pdots:[],pstun:false},dungeon:null,boss:null,
    log:[],seq:1,created:Date.now()};
}
function hydrate(o){
  const d=mkSave(o.nick||"모험가",o.pwh||"",o.cls||"warrior");
  const m={...d,...o};
  m.alloc={...d.alloc,...(o.alloc||{})};
  m.equip={...d.equip,...(o.equip||{})};
  m.world={...d.world,...(o.world||{})};
  m.runeEq=Array.isArray(o.runeEq)&&o.runeEq.length===4?o.runeEq:[null,null,null,null];
  m.inv=o.inv||[]; m.runes=o.runes||[]; m.log=o.log||[];
  m.quests=o.quests||{}; m.questsDone=o.questsDone||{}; m.hiddenClaimed=o.hiddenClaimed||{}; m.hiddenFound=o.hiddenFound||{};
  m.kills=o.kills||{}; m.tagKills=o.tagKills||{}; m.visits=o.visits||{village:1}; m.skills=o.skills||{}; m.lastMon=o.lastMon||{};
  m.dgClears=o.dgClears||{}; m.bossKills=o.bossKills||{}; m.pvpW=o.pvpW||0; m.pvpL=o.pvpL||0;
  m.promoAvail=Array.isArray(o.promoAvail)?o.promoAvail.filter(h=>HID[h]):[];
  /* 스킬 슬롯: 구세이브는 배운 스킬(레거시/히든) 상위 6개로 자동 구성 */
  m.loadout=Array.isArray(o.loadout)?o.loadout.filter(e=>FAMS[e]||SKILLS[e]):[];
  if(!m.loadout.length&&m.skills){
    m.loadout=Object.keys(m.skills).filter(id=>m.skills[id]>0&&(FAMS[id]||SKILLS[id])).slice(0,6);
  }
  if(!CLS[m.cls])m.cls="warrior";
  if(o.promoReady&&!m.hcls&&!m.promoAvail.length&&CLS[m.cls]&&CLS[m.cls].hidden)m.promoAvail=[CLS[m.cls].hidden]; // 구버전 전직 대기 승계
  if(m.hcls&&!HID[m.hcls])m.hcls=null;
  if(!MAPS[m.map])m.map="village";
  m.combat={mon:null,stun:false,buffs:[],shield:0,pdots:[],pstun:false}; m.dungeon=null; m.boss=null; m.mode="hunt"; m._auto=false;
  return m;
}

/* ===================== 스탯 계산 ===================== */
function calc(s){
  const c=CLS[s.cls],L=s.lv-1;
  let hp=c.base.hp+c.grow.hp*L, mp=c.base.mp+c.grow.mp*L, atk=c.base.atk+c.grow.atk*L,
      def=c.base.def+c.grow.def*L, crit=c.base.crit+c.grow.crit*L, critd=c.base.critd+c.grow.critd*L;
  hp+=s.alloc.hp*20; mp+=s.alloc.mp*10; atk+=s.alloc.atk*2; def+=s.alloc.def*2; crit+=s.alloc.crit*0.4; critd+=s.alloc.critd*2;
  for(const slot of SLOTS){
    const it=s.equip[slot]; if(!it)continue;
    const t=ITEMS[it.t]; if(!t)continue;
    const m=(1+0.12*it.plus)*(it.dmg?0.5:1);
    atk+=(t.atk||0)*m; def+=(t.def||0)*m; hp+=(t.hp||0)*m; mp+=(t.mp||0)*m; crit+=(t.crit||0)*m; critd+=(t.critd||0)*m;
  }
  for(const uid of s.runeEq){
    if(!uid)continue;
    const r=s.runes.find(x=>x.uid===uid); if(!r)continue;
    const v=RUNE_T[r.ty].v(r.g);
    if(r.ty==="atk")atk+=v; else if(r.ty==="hp")hp+=v; else if(r.ty==="mp")mp+=v;
    else if(r.ty==="def")def+=v; else if(r.ty==="crit")crit+=v; else critd+=v;
  }
  if(s.hcls){
    const h=HID[s.hcls];
    atk*=h.mult.atk; hp*=h.mult.hp; def*=h.mult.def; mp*=h.mult.mp; crit+=h.mult.critF; critd+=h.mult.critdF;
  }
  return {hp:Math.round(hp),mp:Math.round(mp),atk:Math.round(atk),def:Math.round(def),crit:+clamp(crit,0,80).toFixed(1),critd:Math.round(critd)};
}

/* ===================== 게임 ===================== */
function Game(){
  const S=useRef(null);
  const scr=useRef("login");         // login|create|game
  const tab=useRef("hunt");
  const fuseSel=useRef(null);
  const fx=useRef([]);               // 데미지 플로트 [{id,txt,col,x,born}]
  const fxSeq=useRef(1);
  const shakeK=useRef(0);            // 몬스터 피격 흔들림 키
  const atkFx=useRef(null);          // 공격 모션 {kind,n,key}
  const monLunge=useRef(0);          // 몬스터 돌진 모션 키
  const hurtK=useRef(0);             // 플레이어 피격 비네트 키
  const dgSel=useRef(null);          // 선택한 던전 id (UI)
  const [,bump]=useReducer(x=>x+1,0);
  const [nick,setNick]=useState(""),[pw,setPw]=useState(""),[err,setErr]=useState("");
  const [toast,setToast]=useState(null);
  const [cine,setCine]=useState(null);          // 전설 스킬 컷씬
  const cineT=useRef(null);
  const playCine=(sk)=>{ clearTimeout(cineT.current);
    const ultra=sk.cine==="ultra";
    setCine({icon:sk.icon,name:sk.name,key:Date.now(),ultra,
      col:ultra?(HID_CINE_COL[sk.cls]||"#e879f9"):(CINE_COL[sk.cls]||"#f59e0b"),
      cname:ultra&&HID[sk.cls]?HID[sk.cls].name:null});
    cineT.current=setTimeout(()=>setCine(null),ultra?4400:2600); };
  /* 로드아웃 항목 → 실제 스킬 id (계열은 현재 랭크로 해석) */
  const resolveEntry=(s,e)=>{ if(FAMS[e]){ const r=s.skills[e]||0; return r>0?e+"_"+Math.min(r,50):null; } return (s.skills[e]||0)>0?e:null; };
  const loadoutSkills=(s)=>s.loadout.map(e=>resolveEntry(s,e)).filter(id=>id&&SKILLS[id]);
  const skillLearned=(s,sk,skillId)=>sk&&sk.fam?(((s.skills[sk.fam]||0)>=sk.rank)?1:0):(s.skills[skillId]||0);
  const pend=useRef(null);           // 생성 대기 {nick,pwh}
  const toastT=useRef(null);

  const say=(txt)=>{ setToast(txt); clearTimeout(toastT.current); toastT.current=setTimeout(()=>setToast(null),1800); };
  const lastSaveT=useRef(0);
  const persist=()=>{ const s=S.current; if(!s)return; try{ localStorage.setItem(KEYP+s.nick,JSON.stringify(s)); lastSaveT.current=Date.now(); }catch(e){} };
  const commit=()=>{ persist(); bump(); };
  const log=(txt,cls)=>{ const s=S.current; s.log.unshift({txt,cls:cls||"",id:s.seq++}); if(s.log.length>50)s.log.length=50; };

  /* ---------- 계정 ---------- */
  const accounts=()=>{ const out=[]; try{ for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.startsWith(KEYP))out.push(k.slice(KEYP.length)); } }catch(e){} return out; };
  const doLogin=()=>{
    setErr("");
    if(!nick.trim()||!pw){ setErr("닉네임과 비밀번호를 입력하세요."); return; }
    let raw=null; try{ raw=localStorage.getItem(KEYP+nick.trim()); }catch(e){}
    if(!raw){ setErr("존재하지 않는 계정입니다. [신규 생성]을 눌러주세요."); return; }
    let o=null; try{ o=JSON.parse(raw); }catch(e){ setErr("저장 데이터가 손상되었습니다."); return; }
    if(o.pwh!==hashPw(pw)){ setErr("비밀번호가 일치하지 않습니다."); return; }
    S.current=hydrate(o);
    const st=calc(S.current);
    S.current.hp=clamp(S.current.hp,1,st.hp); S.current.mp=clamp(S.current.mp,0,st.mp);
    scr.current="game"; tab.current="hunt";
    log("🔑 접속 완료. 모험을 계속합니다.","g");
    commit();
  };
  const doCreate=()=>{
    setErr("");
    if(!nick.trim()||!pw){ setErr("닉네임과 비밀번호를 입력하세요."); return; }
    if(nick.trim().length>12){ setErr("닉네임은 12자 이하로 해주세요."); return; }
    let raw=null; try{ raw=localStorage.getItem(KEYP+nick.trim()); }catch(e){}
    if(raw){ setErr("이미 존재하는 닉네임입니다."); return; }
    pend.current={nick:nick.trim(),pwh:hashPw(pw)};
    scr.current="create"; bump();
  };
  const pickClass=(cid)=>{
    const {nick,pwh}=pend.current;
    S.current=mkSave(nick,pwh,cid);
    const st=calc(S.current); S.current.hp=st.hp; S.current.mp=st.mp;
    scr.current="game"; tab.current="hunt";
    log(`${CLS[cid].icon} [${CLS[cid].name}] ${nick}의 모험이 시작됩니다!`,"g");
    commit();
  };
  const logout=()=>{ persist(); leavePlaza(); S.current=null; scr.current="login"; setPw(""); bump(); };

  /* ---------- 전투 ---------- */
  const addFx=(txt,col)=>{ const now=Date.now();
    fx.current=fx.current.filter(f=>now-f.born<900);
    fx.current.push({id:fxSeq.current++,txt,col,x:8+Math.floor(R()*52),born:now});
    if(fx.current.length>8)fx.current.shift(); };
  const resetCombat=()=>({mon:null,stun:false,buffs:[],shield:0,pdots:[],pstun:false});
  const mkMon=t=>({tpl:t,hp:t.hp,maxHp:t.hp,dots:[],shield:0,shielded:false,deb:null});
  const buffVal=(k)=>{ const c=S.current.combat; let v=0; for(const b of c.buffs)if(b.k===k)v+=b.v; return v; };
  const spawn=(monId)=>{
    const s=S.current;
    const t=MONS[monId]; if(!t)return;
    s.lastMon[s.map]=monId;
    const keep=s.combat||{};
    s.combat={...resetCombat(),mon:mkMon(t),buffs:keep.buffs||[],shield:keep.shield||0,pdots:keep.pdots||[],pstun:!!keep.pstun};
  };
  const gainXp=(n)=>{
    const s=S.current; s.xp+=n;
    let need=needXp(s.lv);
    while(s.xp>=need){
      s.xp-=need; s.lv++; s.sp+=5; s.skp+=2;
      const st=calc(s); s.hp=st.hp; s.mp=st.mp;
      log(`🎉 레벨 업! Lv.${s.lv} 달성 (+스탯 5, +스킬 2)`,"g");
      need=needXp(s.lv);
    }
  };
  const addItem=tid=>{ const s=S.current; s.inv.push({uid:"i"+(s.seq++),t:tid,plus:0,dmg:false}); };
  const addRune=(ty,g)=>{ const s=S.current; s.runes.push({uid:"r"+(s.seq++),ty,g}); };
  const drops=(tier)=>{
    const s=S.current;
    if(R()<0.20){ const n=1+(tier>=4?1:0); s.stone+=n; log(`🪨 강화석 +${n}`,"d"); }
    if(R()<0.05){ s.dkey++; log("🗝️ 던전 입장권 획득!","d"); }
    if(R()<0.02){ s.rticket++; log("🎟️ 레이드 입장권 획득!","d"); }
    if(R()<0.07){
      const types=Object.keys(RUNE_T); const ty=types[Math.floor(R()*types.length)];
      const g=clamp(tier-1+(R()<0.2?1:0),1,6); addRune(ty,g);
      log(`💠 [${GRADE[g]}] ${RUNE_T[ty].name} 획득!`,"d");
    }
    if(R()<0.035){
      const pool=TIER_POOL[tier]; const tid=pool[Math.floor(R()*pool.length)];
      addItem(tid); log(`🎁 [${TIER_NAME[tier]}] ${ITEMS[tid].name} 획득!`,"d");
    }
  };
  const checkHidden=()=>{
    const s=S.current;
    for(const h of HIDQ){
      if(!s.hiddenClaimed[h.id]&&!s.hiddenFound[h.id]&&h.check(s)){
        s.hiddenFound[h.id]=true;
        log(`❗ 히든 퀘스트 발견: [${h.name}] — 퀘스트 탭에서 보상을 받으세요!`,"g");
      }
    }
  };
  const checkPromo=()=>{
    const s=S.current;
    if(s.hcls)return;
    const st=calc(s);
    for(const hid of Object.keys(HID)){
      if(s.promoAvail.includes(hid))continue;
      const H=HID[hid];
      if(H.base!=="any"&&H.base!==CLS[s.cls].grp)continue;
      let ok=false; try{ ok=H.check(s,st); }catch(e){}
      if(ok){ s.promoAvail.push(hid); log(`🌟 히든 직업 [${H.name}] 전직 조건 달성! 가방 탭에서 전직하세요.`,"g"); }
    }
  };
  const promote=(hid)=>{
    const s=S.current;
    if(s.hcls||!s.promoAvail.includes(hid))return;
    const H=HID[hid]; if(!H)return;
    s.hcls=hid; s.promoReady=false; s.skills[H.skill]=1;
    const st=calc(s); s.hp=st.hp; s.mp=st.mp;
    log(`${H.icon} [${H.name}]로 전직했습니다! 고유 스킬 [${SKILLS[H.skill].name}] 습득!`,"g");
    commit();
  };
  const giveUpHidden=()=>{
    const s=S.current;
    if(!s.hcls)return;
    const H=HID[s.hcls];
    const cost=Math.round(1500*s.lv);
    if(s.gold<cost){ say(`골드가 부족합니다. (필요 ${fmt(cost)}G)`); return; }
    if(!window.confirm(`[${H.icon} ${H.name}] 전직을 포기할까요?\n\n비용: ${fmt(cost)}G\n히든 스킬 [${SKILLS[H.skill].name}]을 잃습니다.\n\n이미 조건을 만족한 다른 히든 직업이 있다면 즉시 재전직할 수 있습니다.`))return;
    s.gold-=cost;
    delete s.skills[H.skill];
    if(s.autoSkill===H.skill)s.autoSkill=null;
    const oldName=H.name;
    s.hcls=null;
    const st=calc(s); s.hp=Math.min(s.hp,st.hp); s.mp=Math.min(s.mp,st.mp);
    log(`💔 [${oldName}] 전직을 포기했습니다. (-${fmt(cost)}G) 가방 탭에서 다른 히든 직업으로 전직할 수 있습니다.`,"r");
    checkPromo(); commit();
  };
  const death=()=>{
    const s=S.current;
    s.deaths++; s.hp=0;
    const lost=Math.floor(s.gold*0.05); s.gold-=lost;
    log(`💀 사망… 골드 ${fmt(lost)} 잃고 초보자 마을에서 부활합니다.`,"r");
    s.map="village"; s.visits.village=(s.visits.village||0)+1;
    s.mode="hunt"; s.combat=resetCombat(); s.dungeon=null; s.boss=null; s._auto=false;
    const st=calc(s); s.hp=Math.round(st.hp*0.3); s.mp=Math.round(st.mp*0.3);
    checkHidden();
  };
  const hurtPlayer=(dmg)=>{ // 보호막 → HP 순서로 피해 적용, 실제 HP 피해량 반환
    const c=S.current.combat;
    if(c.shield>0){ const ab=Math.min(c.shield,dmg); c.shield-=ab; dmg-=ab; if(ab>0)log(`🔷 보호막이 ${fmt(ab)} 피해를 흡수!`); }
    if(dmg>0)S.current.hp-=dmg;
    return dmg;
  };
  const monsterTurn=()=>{
    const s=S.current, mon=s.combat.mon, c=s.combat;
    if(!mon||mon.hp<=0)return;
    /* 몬스터 도트 (내가 건 화상/중독) */
    if(mon.dots.length){
      let tot=0;
      mon.dots.forEach(d=>{ tot+=d.dmg; d.t--; });
      mon.dots=mon.dots.filter(d=>d.t>0);
      if(tot>0){ mon.hp-=tot; addFx("-"+fmt(tot),"#a3e635"); log(`🧪 지속 피해로 ${mon.tpl.name}에게 ${fmt(tot)} 피해`,"d"); }
      if(mon.hp<=0){ mon.hp=0; onKill(); return; }
    }
    if(c.stun){ c.stun=false; log(`💫 ${mon.tpl.name}이(가) 기절해 행동하지 못합니다!`); return; }
    const st=calc(s);
    const mech=mon.tpl.mech||[];
    /* 재생 */
    if(mech.includes("regen")&&mon.hp<mon.maxHp){ const h=Math.round(mon.maxHp*0.03); mon.hp=Math.min(mon.maxHp,mon.hp+h); log(`💚 ${mon.tpl.name}이(가) ${fmt(h)} 회복`,"r"); }
    /* 수호막 (60% 이하 1회) */
    if(mech.includes("shieldp")&&!mon.shielded&&mon.hp<=mon.maxHp*0.6){ mon.shielded=true; mon.shield=Math.round(mon.maxHp*0.15); log(`🛡️ ${mon.tpl.name}이(가) 수호막을 펼쳤다! (${fmt(mon.shield)})`,"r"); }
    /* 공격 (연격 시 2회) */
    let atkEff=mon.tpl.atk;
    if(mech.includes("enrage")&&mon.hp<=mon.maxHp*0.4)atkEff=Math.round(atkEff*1.5);
    if(mon.deb){ atkEff=Math.round(atkEff*(1-mon.deb.v)); }
    const hits=mech.includes("double")?2:1;
    const defEff=st.def*0.55*(mech.includes("crush")?0.5:1);
    const dodge=buffVal("dodge");
    for(let i=0;i<hits;i++){
      if(s.hp<=0)break;
      if(dodge>0&&R()<dodge){ log(`💨 ${mon.tpl.name}의 공격을 회피!`,"g"); continue; }
      const raw=Math.max(1,Math.round((atkEff-defEff)*(0.85+R()*0.3)));
      const dealt=hurtPlayer(raw);
      monLunge.current=Date.now(); hurtK.current=Date.now();
      log(`🩸 ${mon.tpl.name}의 공격! -${fmt(raw)}`,"r");
      if(dealt>0&&mech.includes("lifesteal")){ const h=Math.round(dealt*0.3); mon.hp=Math.min(mon.maxHp,mon.hp+h); }
      if(mech.includes("burn")&&R()<0.35){ c.pdots=c.pdots.filter(d=>d.k!=="burn"); c.pdots.push({k:"burn",dmg:Math.round(atkEff*0.5),t:3}); log("🔥 화상에 걸렸다! (3턴)","r"); }
      if(mech.includes("poison")&&R()<0.35){ c.pdots=c.pdots.filter(d=>d.k!=="poison"); c.pdots.push({k:"poison",dmg:Math.round(atkEff*0.5),t:3}); log("☠️ 중독되었다! (3턴)","r"); }
      if(mech.includes("stunp")&&R()<0.2){ c.pstun=true; log("💫 충격! 다음 공격 위력 -50%","r"); }
    }
    /* 내 도트 (화상/중독) */
    if(s.hp>0&&c.pdots.length){
      let tot=0; c.pdots.forEach(d=>{ tot+=d.dmg; d.t--; }); c.pdots=c.pdots.filter(d=>d.t>0);
      if(tot>0){ s.hp-=tot; log(`🧪 지속 피해 -${fmt(tot)}`,"r"); }
    }
    /* 몬스터 공격력 디버프 턴 감소 */
    if(mon.deb){ mon.deb.t--; if(mon.deb.t<=0)mon.deb=null; }
    if(s.hp<=0)death();
  };
  const questTick=()=>{}; // 진행도는 카운터 기반으로 파생 계산
  const onKill=()=>{
    const s=S.current, mon=s.combat.mon, t=mon.tpl;
    s.killTotal++; s.kills[t.id]=(s.kills[t.id]||0)+1;
    (t.tags||[]).forEach(tg=>s.tagKills[tg]=(s.tagKills[tg]||0)+1);
    const xpMul=s.world.done?1.25:1;
    let gx=Math.round(t.xp*xpMul), gg=t.gold;
    const dmod=s.mode==="dungeon"&&s.dungeon?DG_MAP[s.dungeon.id].mod:null;
    if(s.mode==="dungeon"){
      gx=Math.round(gx*2*(dmod==="xp"?1.7:1));
      gg=Math.round(gg*2.2*(dmod==="gold"?2:1));
    }
    s.gold+=gg;
    log(`☠️ ${t.name} 처치! +${fmt(gx)}XP +${fmt(gg)}G`);
    gainXp(gx);
    if(s.mode!=="boss")drops(Math.min(t.tier,6));
    s.world.prog=Math.min(s.world.goal,s.world.prog+2+Math.floor(R()*9));
    if(!s.world.done&&s.world.prog>=s.world.goal){ s.world.done=true; log("🌍 월드 퀘스트 달성! 모든 모험가에게 경험치 +25% 버프!","g"); }
    const st=calc(s);
    if(dmod!=="noheal"){
      s.hp=Math.min(st.hp,s.hp+Math.round(st.hp*0.1));
      s.mp=Math.min(st.mp,s.mp+Math.round(st.mp*0.1));
    }
    if(s.mode==="hunt"){ spawn(t.id); }
    else if(s.mode==="dungeon"){ dungeonNext(); }
    else if(s.mode==="boss"){ bossWin(t); }
    checkHidden(); checkPromo();
  };
  const playerTurn=(skillId,isAuto)=>{
    const s=S.current;
    if(!s||scr.current!=="game")return;
    if(s.hp<=0){ if(!isAuto)say("체력이 없습니다. 여관에서 회복하세요."); return; }
    if(!s.combat.mon){
      if(s.mode==="hunt"){ const mid=s.lastMon[s.map]||MAPS[s.map].mons[0]; spawn(mid); }
      else return;
    }
    const c=s.combat, mon=c.mon;
    const st=calc(s);
    const dmod=s.mode==="dungeon"&&s.dungeon?DG_MAP[s.dungeon.id].mod:null;
    let mult=1, sfx={}, usedSkill=null, hits=1;
    if(skillId){
      const sk=SKILLS[skillId], slv=skillLearned(s,sk,skillId);
      if(!sk||!slv){ if(!isAuto)say("아직 습득하지 않은 스킬입니다."); }
      else if(s.mp<sk.mp){ if(!isAuto){ say("MP가 부족합니다!"); return; } }
      else { s.mp-=sk.mp; mult=sk.mult*(1+0.12*(slv-1)); sfx=sk.fx||{}; usedSkill=sk; hits=sk.hits||1;
        if(sk.cine)playCine(sk); }
    }
    /* --- 공격 페이즈 (보조 스킬 mult 0 제외) --- */
    let total=0;
    if(!usedSkill||usedSkill.mult>0){
      const atkEff=st.atk*(1+buffVal("atk"));
      let critCh;
      if(sfx.gcrit)critCh=100;
      else if(dmod==="dark")critCh=0;
      else critCh=st.crit+buffVal("critf")+(sfx.critB||0);
      let anyCrit=false;
      for(let i=0;i<hits;i++){
        let m=mult;
        if(sfx.exec&&mon.hp<=mon.maxHp*sfx.exec.below)m=mult*sfx.exec.mult;
        const isCrit=R()*100<critCh; if(isCrit)anyCrit=true;
        let dmg=Math.max(1,Math.round((atkEff*m-mon.tpl.def)*(0.9+R()*0.2)));
        if(isCrit)dmg=Math.round(dmg*(st.critd+(sfx.critdB||0))/100);
        if(c.pstun)dmg=Math.max(1,Math.round(dmg*0.5));
        if(mon.shield>0){ const ab=Math.min(mon.shield,dmg); mon.shield-=ab; dmg-=ab; if(ab>0)log(`🛡️ 수호막이 ${fmt(ab)} 흡수`); }
        mon.hp-=dmg; total+=dmg;
        addFx("-"+fmt(dmg),isCrit?"#fde047":"#fca5a5");
        if(mon.hp<=0)break;
      }
      if(c.pstun)c.pstun=false;
      shakeK.current++;
      atkFx.current={kind:usedSkill?(hits>1?"multi":"burst"):"slash",n:Math.min(hits,3),key:Date.now()+R()};
      log(`${usedSkill?usedSkill.icon+" ["+usedSkill.name+"]":"⚔️"} ${anyCrit?"치명타! ":""}${hits>1?hits+"연격! ":""}${mon.tpl.name}에게 ${fmt(total)} 피해`,anyCrit?"c":"");
      if(dmod==="thorn"&&total>0&&s.hp>0){ const th=Math.max(1,Math.round(total*0.12)); hurtPlayer(th); log(`🌵 가시 반사 -${fmt(th)}`,"r"); }
      if(sfx.heal&&total>0){ s.hp=Math.min(st.hp,s.hp+Math.round(total*sfx.heal)); }
      if(sfx.mpR)s.mp=Math.min(st.mp,s.mp+Math.round(st.mp*sfx.mpR));
      if(sfx.stun&&mon.hp>0)c.stun=true;
      if(sfx.dot&&mon.hp>0){
        const dd=Math.max(1,Math.round(atkEff*sfx.dot.pct));
        mon.dots=mon.dots.filter(d=>d.k!==sfx.dot.k);
        mon.dots.push({k:sfx.dot.k,dmg:dd,t:sfx.dot.t});
        log(`${sfx.dot.k==="burn"?"🔥 화상":"☠️ 중독"} 부여! (턴당 ${fmt(dd)}, ${sfx.dot.t}턴)`,"d");
      }
      if(sfx.deb&&mon.hp>0){ mon.deb={v:sfx.deb.v,t:sfx.deb.t}; log(`😤 ${mon.tpl.name} 공격력 -${Math.round(sfx.deb.v*100)}% (${sfx.deb.t}턴)`,"d"); }
    } else {
      log(`${usedSkill.icon} [${usedSkill.name}] 사용!`,"g");
    }
    /* --- 보조 효과 --- */
    if(usedSkill){
      if(sfx.selfHeal){ const h=Math.round(st.hp*sfx.selfHeal); s.hp=Math.min(st.hp,s.hp+h); log(`💞 HP ${fmt(h)} 회복`,"g"); }
      if(sfx.shield){ const v=Math.round(st.hp*sfx.shield); c.shield=Math.max(c.shield,v); log(`🔷 보호막 ${fmt(v)} 생성`,"g"); }
      const pushBuff=(k,v,t,icon,name)=>{ c.buffs=c.buffs.filter(b=>b.k!==k); c.buffs.push({k,v,t,icon,name}); };
      if(sfx.atkB)pushBuff("atk",sfx.atkB.v,sfx.atkB.t,"⚔️","공격 +"+Math.round(sfx.atkB.v*100)+"%");
      if(sfx.critBf)pushBuff("critf",sfx.critBf.v,sfx.critBf.t,"🎯","치명 +"+sfx.critBf.v+"%");
      if(sfx.dodge)pushBuff("dodge",sfx.dodge.v,sfx.dodge.t,"💨","회피 "+Math.round(sfx.dodge.v*100)+"%");
    }
    s.mp=Math.min(st.mp,s.mp+Math.round(st.mp*0.03));
    if(mon.hp<=0){ mon.hp=0; onKill(); }
    else{
      monsterTurn();
      if(s.mode==="boss"&&s.boss){
        s.boss.turns--;
        if(s.boss.turns<=0&&s.combat.mon&&s.combat.mon.hp>0){
          log(`⏳ 턴 제한 초과! ${s.combat.mon.tpl.name} 토벌 실패…`,"r");
          s.mode="hunt"; s.combat=resetCombat(); s.boss=null;
        }
      }
    }
    /* 독안개 */
    if(dmod==="poison"&&s.hp>0&&s.mode==="dungeon"){
      const p=Math.max(1,Math.round(st.hp*0.02)); s.hp-=p; log(`🟣 독안개 -${fmt(p)}`,"r");
      if(s.hp<=0)death();
    }
    /* 버프 턴 경과 */
    c.buffs.forEach(b=>b.t--); c.buffs=c.buffs.filter(b=>b.t>0);
    commit();
  };
  const flee=()=>{
    const s=S.current;
    if(s.mode==="dungeon"){ log("🏃 던전에서 후퇴했습니다. (입장권은 소모됨)","r"); }
    else if(s.mode==="boss"){ log("🏃 레이드를 포기했습니다.","r"); }
    s.mode="hunt"; s.combat=resetCombat(); s.dungeon=null; s.boss=null; s._auto=false;
    commit();
  };

  /* ---------- 던전 (30종 카탈로그) ---------- */
  const dgWaves=d=>DG_MAP[d].mod==="swarm"?7:5;
  const dungeonWave=()=>{
    const s=S.current, d=s.dungeon, D=DG_MAP[d.id], mod=D.mod;
    const pool=DG_POOL[D.t];
    const total=dgWaves(d.id);
    const base=MONS[d.wave>=total?pool[pool.length-1]:pool[Math.floor(R()*pool.length)]];
    const tierM=DG_MUL[D.t];
    let hpM=(1.4+0.5*d.wave)*tierM*(mod==="elite"?1.8:1);
    let atkM=(1.1+0.15*d.wave)*tierM*(mod==="berserk"?1.4:1);
    let defM=1.2*tierM*(mod==="iron"?1.6:1);
    const t={...base,name:`${base.name} · ${D.n} ${d.wave}층`,hp:Math.round(base.hp*hpM),atk:Math.round(base.atk*atkM),def:Math.round(base.def*defM),xp:Math.round(base.xp*1.5*tierM),gold:Math.round(base.gold*1.4*tierM)};
    const keep=s.combat||{};
    s.combat={...resetCombat(),mon:mkMon(t),buffs:keep.buffs||[],shield:keep.shield||0,pdots:keep.pdots||[],pstun:!!keep.pstun};
  };
  const enterDungeon=(dgId)=>{
    const s=S.current, D=DG_MAP[dgId];
    if(!D)return;
    if(s.mode!=="hunt"){ say("이미 전투 콘텐츠 진행 중입니다."); return; }
    if(s.lv<D.lvq){ say(`레벨 ${D.lvq}부터 입장할 수 있습니다.`); return; }
    if(s.dkey<1){ say("던전 입장권이 없습니다!"); return; }
    s.dkey--; s.mode="dungeon"; s.dungeon={id:dgId,wave:1};
    const M=MODS[D.mod];
    log(`🕳️ [${D.n}] 입장! (${dgWaves(dgId)}웨이브${D.mod!=="none"?` · ${M.icon} ${M.n}: ${M.d}`:""})`,"g");
    dungeonWave(); tab.current="hunt"; commit();
  };
  const dungeonNext=()=>{
    const s=S.current, d=s.dungeon, D=DG_MAP[d.id], mod=D.mod;
    const total=dgWaves(d.id);
    if(d.wave>=total){
      const tier=D.t;
      const richM=(mod==="rich"?1.8:1)*(mod==="swarm"?1.3:1);
      const stones=Math.round((4+2*tier)*richM), gold=Math.round(150*tier*tier*richM);
      s.stone+=stones; s.gold+=gold;
      const types=Object.keys(RUNE_T); const ty=types[Math.floor(R()*types.length)];
      const rg=clamp(tier+(mod==="elite"?1:0),1,6);
      addRune(ty,rg);
      let itemTxt="";
      if(R()<(tier>=6?0.55:0.4)){ const pool=TIER_POOL[Math.min(tier,6)]; const tid=pool[Math.floor(R()*pool.length)]; addItem(tid); itemTxt=` + [${TIER_NAME[ITEMS[tid].tier]}] ${ITEMS[tid].name}`; }
      s.dgClears[d.id]=(s.dgClears[d.id]||0)+1;
      log(`🏆 [${D.n}] 클리어! 강화석 ${stones}, ${fmt(gold)}G, [${GRADE[rg]}] ${RUNE_T[ty].name}${itemTxt}`,"g");
      s.mode="hunt"; s.dungeon=null; s.combat=resetCombat();
    } else { d.wave++; dungeonWave(); log(`⬇️ 웨이브 ${d.wave}/${total} 진입!`); }
  };

  /* ---------- 보스 (35종 카탈로그) ---------- */
  const enterBoss=(bossId)=>{
    const s=S.current, B=BOSSES[bossId];
    if(!B)return;
    if(s.mode!=="hunt"){ say("이미 전투 콘텐츠 진행 중입니다."); return; }
    if(s.lv<B.lvq){ say(`레벨 ${B.lvq}부터 도전할 수 있습니다.`); return; }
    if(s.rticket<1){ say("레이드 입장권이 없습니다!"); return; }
    s.rticket--;
    s.mode="boss"; s.boss={id:bossId,turns:B.turns};
    s.combat={...resetCombat(),mon:mkMon(B)};
    const mtxt=(B.mech||[]).map(m=>MECH[m].icon+MECH[m].n).join(" ");
    log(`👹 보스 레이드! [${B.name}] — ${B.turns}턴 제한${mtxt?` · 기믹: ${mtxt}`:""}`,"r");
    tab.current="hunt"; commit();
  };
  const bossWin=(t)=>{
    const s=S.current;
    const stones=6+3*t.tier; s.stone+=stones;
    const types=Object.keys(RUNE_T); const ty=types[Math.floor(R()*types.length)];
    const g=clamp(t.tier>=7?6:t.tier+1,1,6); addRune(ty,g);
    const it=BOSS_ITEM_T[t.tier]; const pool=TIER_POOL[it]; const tid=pool[Math.floor(R()*pool.length)]; addItem(tid);
    if(t.tier>=6&&R()<0.5){ s.rticket++; log("🎟️ 레이드 입장권을 되찾았다!","d"); }
    s.bossKills[t.id]=(s.bossKills[t.id]||0)+1;
    log(`🏆 레이드 성공! 강화석 ${stones}, [${GRADE[g]}] ${RUNE_T[ty].name}, [${TIER_NAME[it]}] ${ITEMS[tid].name} 획득!`,"g");
    s.mode="hunt"; s.boss=null; s.combat=resetCombat();
  };

  /* ---------- 포탈 ---------- */
  const usePortal=(mid)=>{
    const s=S.current;
    if(s.mode!=="hunt"){ say("던전/레이드 중에는 이동할 수 없습니다. 먼저 후퇴하세요."); return; }
    if(!MAPS[s.map].portals.includes(mid))return;
    s.map=mid; s.visits[mid]=(s.visits[mid]||0)+1;
    s.combat=resetCombat(); s._auto=false;
    log(`🌀 포탈 이동 → ${MAPS[mid].icon} ${MAPS[mid].name}`);
    checkHidden(); checkPromo(); commit();
  };
  const travelWorld=(w)=>{
    const s=S.current, W=WORLDS.find(x=>x.w===w);
    if(!W)return;
    if(s.mode!=="hunt"){ say("던전/레이드 중에는 이동할 수 없습니다."); return; }
    if(s.lv<W.lv){ say(`레벨 ${W.lv}부터 입장할 수 있습니다.`); return; }
    s.map=W.start; s.visits[W.start]=(s.visits[W.start]||0)+1;
    s.combat=resetCombat(); s._auto=false;
    log(`${W.icon} 차원 관문 → [${W.name}] ${MAPS[W.start].name}에 도착했습니다!`,"g");
    checkHidden(); checkPromo(); commit();
  };

  /* ---------- 대장간 ---------- */
  const allItems=()=>{ const s=S.current; const out=[];
    for(const slot of SLOTS){ if(s.equip[slot])out.push({inst:s.equip[slot],eq:slot}); }
    for(const it of s.inv)out.push({inst:it,eq:null});
    return out; };
  const enhance=(uid)=>{
    const s=S.current;
    const found=allItems().find(x=>x.inst.uid===uid); if(!found)return;
    const it=found.inst;
    if(it.plus>=15){ say("최대 강화 단계(+15)입니다."); return; }
    const gold=80*(it.plus+1)*(it.plus+1), stones=Math.ceil((it.plus+1)/2);
    if(s.gold<gold){ say("골드가 부족합니다."); return; }
    if(s.stone<stones){ say("강화석이 부족합니다."); return; }
    s.gold-=gold; s.stone-=stones;
    const rate=Math.max(0.08,1-it.plus*0.08);
    if(R()<rate){
      it.plus++; s.enhOk++; s.failStreak=0;
      log(`⚒️ 강화 성공! ${ITEMS[it.t].name} +${it.plus}`,"g");
    } else {
      s.failStreak++;
      let dmgTxt="";
      if(it.plus>=5&&R()<0.25&&!it.dmg){ it.dmg=true; dmgTxt=" 장비가 손상되었습니다!"; }
      log(`💥 강화 실패… (연속 ${s.failStreak}회)${dmgTxt}`,"r");
    }
    checkHidden(); checkPromo(); commit();
  };
  const repair=(uid)=>{
    const s=S.current;
    const found=allItems().find(x=>x.inst.uid===uid); if(!found||!found.inst.dmg)return;
    const cost=150*ITEMS[found.inst.t].tier;
    if(s.gold<cost){ say("골드가 부족합니다."); return; }
    s.gold-=cost; found.inst.dmg=false;
    log(`🔧 ${ITEMS[found.inst.t].name} 수리 완료!`,"g"); commit();
  };
  const equipItem=(uid)=>{
    const s=S.current;
    const idx=s.inv.findIndex(x=>x.uid===uid); if(idx<0)return;
    const it=s.inv[idx], slot=ITEMS[it.t].slot;
    const old=s.equip[slot];
    s.equip[slot]=it; s.inv.splice(idx,1);
    if(old)s.inv.push(old);
    const st=calc(s); s.hp=Math.min(s.hp,st.hp); s.mp=Math.min(s.mp,st.mp);
    log(`🎽 ${ITEMS[it.t].name} 장착!`); checkPromo(); commit();
  };
  const unequipItem=(slot)=>{
    const s=S.current; const it=s.equip[slot]; if(!it)return;
    s.equip[slot]=null; s.inv.push(it);
    const st=calc(s); s.hp=Math.min(s.hp,st.hp); s.mp=Math.min(s.mp,st.mp);
    commit();
  };
  const sellItem=(uid)=>{
    const s=S.current;
    const idx=s.inv.findIndex(x=>x.uid===uid); if(idx<0)return;
    const it=s.inv[idx];
    const price=Math.round(ITEMS[it.t].tier*40*(1+it.plus*0.5));
    s.inv.splice(idx,1); s.gold+=price;
    log(`💰 ${ITEMS[it.t].name} 판매 +${fmt(price)}G`); commit();
  };

  /* ---------- 룬 ---------- */
  const equipRune=(uid)=>{
    const s=S.current;
    if(s.runeEq.includes(uid))return;
    const slot=s.runeEq.findIndex(x=>!x);
    if(slot<0){ say("룬 슬롯이 가득 찼습니다. (4칸)"); return; }
    s.runeEq[slot]=uid; checkPromo(); commit();
  };
  const unequipRune=(slot)=>{ const s=S.current; s.runeEq[slot]=null; commit(); };
  const fuseClick=(uid)=>{
    const s=S.current;
    if(s.runeEq.includes(uid)){ say("장착 중인 룬은 합성할 수 없습니다."); return; }
    if(!fuseSel.current){ fuseSel.current=uid; bump(); return; }
    if(fuseSel.current===uid){ fuseSel.current=null; bump(); return; }
    const a=s.runes.find(x=>x.uid===fuseSel.current), b=s.runes.find(x=>x.uid===uid);
    if(!a||!b){ fuseSel.current=null; bump(); return; }
    if(a.ty!==b.ty||a.g!==b.g){ say("같은 종류·같은 등급의 룬 2개만 합성할 수 있습니다."); fuseSel.current=null; bump(); return; }
    if(a.g>=6){ say("이미 최고 등급(전설)입니다."); fuseSel.current=null; bump(); return; }
    s.runes=s.runes.filter(x=>x.uid!==a.uid&&x.uid!==b.uid);
    addRune(a.ty,a.g+1); s.fuseCount++;
    log(`✨ 룬 합성 성공! [${GRADE[a.g+1]}] ${RUNE_T[a.ty].name} 탄생!`,"g");
    fuseSel.current=null; checkHidden(); checkPromo(); commit();
  };
  const sellRune=(uid)=>{
    const s=S.current;
    if(s.runeEq.includes(uid)){ say("장착 중인 룬은 판매할 수 없습니다."); return; }
    const idx=s.runes.findIndex(x=>x.uid===uid); if(idx<0)return;
    const r=s.runes[idx]; const price=r.g*r.g*40;
    s.runes.splice(idx,1); s.gold+=price;
    if(fuseSel.current===uid)fuseSel.current=null;
    log(`💰 룬 판매 +${fmt(price)}G`); commit();
  };

  /* ---------- 스킬 ---------- */
  const learnSkill=(id)=>{
    const s=S.current, sk=SKILLS[id];
    if(sk.cls!==s.cls&&sk.cls!==s.hcls)return;
    if(s.lv<sk.lv){ say(`레벨 ${sk.lv}부터 습득 가능합니다.`); return; }
    const cur=s.skills[id]||0;
    if(cur>=10){ say("최대 레벨(10)입니다."); return; }
    if(s.skp<1){ say("스킬 포인트가 부족합니다."); return; }
    s.skp--; s.skills[id]=cur+1;
    log(cur===0?`📜 [${sk.name}] 습득!`:`📜 [${sk.name}] Lv.${cur+1} 강화!`,"g");
    commit();
  };
  const learnFam=(famId)=>{                                 // 계열 랭크업 (1SP)
    const s=S.current, F=FAMS[famId];
    if(!F||F.cid!==s.cls)return;
    const cur=s.skills[famId]||0;
    if(cur>=F.maxR){ say("최대 랭크(50식)입니다."); return; }
    const nxt=SKILLS[famId+"_"+(cur+1)];
    if(s.lv<nxt.lv){ say(`레벨 ${nxt.lv}부터 랭크업 가능합니다.`); return; }
    if(s.skp<1){ say("스킬 포인트가 부족합니다."); return; }
    s.skp--; s.skills[famId]=cur+1;
    log(cur===0?`📜 [${F.name} 1식] 습득!`:`📜 [${F.name}] ${cur+1}식으로 랭크업!`,"g");
    if(cur===0&&s.loadout.length<6&&!s.loadout.includes(famId))s.loadout.push(famId);
    commit();
  };
  const learnLeg=(id)=>{                                    // 전설 스킬 (5SP)
    const s=S.current, sk=SKILLS[id];
    if(!sk||!sk.leg||sk.cls!==s.cls)return;
    if(s.skills[id]){ say("이미 습득한 전설 스킬입니다."); return; }
    if(s.lv<sk.lv){ say(`레벨 ${sk.lv}부터 각성할 수 있습니다.`); return; }
    if(s.skp<5){ say("스킬 포인트 5가 필요합니다."); return; }
    s.skp-=5; s.skills[id]=1;
    log(`🌟 전설 스킬 [${sk.name}] 각성! 사용 시 컷씬이 발동합니다!`,"g");
    if(s.loadout.length<6&&!s.loadout.includes(id))s.loadout.push(id);
    commit();
  };
  const toggleLoadout=(entry)=>{                            // 스킬 슬롯 (6칸)
    const s=S.current;
    const i=s.loadout.indexOf(entry);
    if(i>=0){ s.loadout.splice(i,1); if(s.autoSkill===entry)s.autoSkill=null; }
    else{
      if(s.loadout.length>=6){ say("스킬 슬롯이 가득 찼습니다. (6칸)"); return; }
      s.loadout.push(entry);
    }
    commit();
  };

  /* ---------- 퀘스트 ---------- */
  const qSnap=(q)=>{ const s=S.current;
    if(q.type==="kill")return s.kills[q.target]||0;
    if(q.type==="ktag")return s.tagKills[q.target]||0;
    if(q.type==="enh")return s.enhOk;
    if(q.type==="fuse")return s.fuseCount;
    return 0; };
  const qProg=(q)=>{ const s=S.current, a=s.quests[q.id]; if(!a)return 0;
    if(q.type==="level")return s.lv;
    return clamp(qSnap(q)-a.at,0,q.n); };
  const acceptQuest=(q)=>{
    const s=S.current;
    if(Object.keys(s.quests).length>=5){ say("동시 진행 퀘스트는 5개까지입니다."); return; }
    if(s.quests[q.id])return;
    if(!q.repeat&&s.questsDone[q.id]){ say("이미 완료한 퀘스트입니다."); return; }
    s.quests[q.id]={at:q.type==="level"?0:qSnap(q)};
    log(`📋 퀘스트 수락: [${q.name}]`); commit();
  };
  const claimQuest=(q)=>{
    const s=S.current;
    if(qProg(q)<q.n)return;
    delete s.quests[q.id];
    s.questsDone[q.id]=(s.questsDone[q.id]||0)+1;
    if(q.rw.gold)s.gold+=q.rw.gold;
    if(q.rw.stone)s.stone+=q.rw.stone;
    log(`✅ 퀘스트 완료: [${q.name}] — ${q.rw.gold?fmt(q.rw.gold)+"G ":""}${q.rw.stone?"강화석"+q.rw.stone+" ":""}${q.rw.xp?fmt(q.rw.xp)+"XP":""}`,"g");
    if(q.rw.xp)gainXp(q.rw.xp);
    checkHidden(); checkPromo(); commit();
  };
  const claimHidden=(h)=>{
    const s=S.current;
    if(s.hiddenClaimed[h.id]||!h.check(s))return;
    s.hiddenClaimed[h.id]=true;
    if(h.rw.gold)s.gold+=h.rw.gold;
    if(h.rw.stone)s.stone+=h.rw.stone;
    if(h.rw.skp)s.skp+=h.rw.skp;
    if(h.rw.dkey)s.dkey+=h.rw.dkey;
    if(h.rw.rticket)s.rticket+=h.rw.rticket;
    if(h.rw.rune)addRune(h.rw.rune.t,h.rw.rune.g);
    log(`🎖️ 히든 퀘스트 보상 수령: [${h.name}]!`,"g");
    commit();
  };
  const donate=(amt)=>{
    const s=S.current;
    if(s.world.done){ say("이미 목표를 달성했습니다!"); return; }
    amt=Math.min(amt,s.gold,s.world.goal-s.world.prog);
    if(amt<=0){ say("골드가 부족합니다."); return; }
    s.gold-=amt; s.world.donated+=amt;
    s.world.prog=Math.min(s.world.goal,s.world.prog+amt);
    if(s.world.prog>=s.world.goal){ s.world.done=true; log("🌍 월드 퀘스트 달성! 경험치 +25% 버프 영구 적용!","g"); }
    else log(`🌍 ${fmt(amt)}G 기부 (누적 ${fmt(s.world.donated)}G)`);
    commit();
  };

  /* ---------- 여관 ---------- */
  const rest=()=>{
    const s=S.current;
    const cost=50+s.lv*12;
    if(s.gold<cost){ say("골드가 부족합니다."); return; }
    if(s.mode!=="hunt"){ say("전투 콘텐츠 중에는 쉴 수 없습니다."); return; }
    s.gold-=cost; s.innCount++;
    const st=calc(s); s.hp=st.hp; s.mp=st.mp;
    log(`🛏️ 푹 쉬었습니다. HP/MP 전체 회복! (-${fmt(cost)}G)`,"g");
    checkHidden(); checkPromo(); persist(); say("회복 & 자동 저장 완료!"); bump();
  };

  /* ---------- 스탯 분배 ---------- */
  const allocPt=(k)=>{
    const s=S.current;
    if(s.sp<1)return;
    s.sp--; s.alloc[k]++;
    checkPromo(); commit();
  };

  /* ---------- 자동 사냥 ---------- */
  useEffect(()=>{
    const iv=setInterval(()=>{
      const s=S.current;
      if(!s||scr.current!=="game"||!s._auto)return;
      if(s.hp<=0){ s._auto=false; bump(); return; }
      let skill=null;
      if(s.autoSkill){
        const rid=resolveEntry(s,s.autoSkill);
        if(rid&&SKILLS[rid]&&!SKILLS[rid].cine&&s.mp>=SKILLS[rid].mp)skill=rid;
      }
      playerTurn(skill,true);
    },1100);
    return ()=>clearInterval(iv);
  },[]);

  /* ---------- 자동 저장 (20초 주기 + 창 닫기 직전) ---------- */
  useEffect(()=>{
    const iv=setInterval(()=>{
      if(S.current&&scr.current==="game"){ persist(); bump(); }
    },20000);
    const onUnload=()=>{ if(S.current)persist(); };
    window.addEventListener("beforeunload",onUnload);
    return ()=>{ clearInterval(iv); window.removeEventListener("beforeunload",onUnload); };
  },[]);

  /* ================= 광장 (P2P 온라인) ================= */
  const plaza=useRef({room:null,acts:null,peers:{},chat:[],duel:null,pending:null,joining:false,raid:null,parties:{}});
  const [chatIn,setChatIn]=useState("");

  const pSnap=()=>{ const s=S.current, st=calc(s);
    return {nick:s.nick,lv:s.lv,icon:s.hcls?HID[s.hcls].icon:CLS[s.cls].icon,cname:s.hcls?HID[s.hcls].name:CLS[s.cls].name,
      w:s.pvpW,l:s.pvpL,hp:st.hp,mp:st.mp,atk:st.atk,def:st.def,crit:st.crit,critd:st.critd}; };
  const sendHello=()=>{ const P=plaza.current; if(P.room&&S.current)P.acts.hello.send(pSnap()); };
  const joinPlaza=()=>{
    const P=plaza.current;
    if(P.room||P.joining)return;
    P.joining=true; bump();
    ensureTrystero(t=>{
      if(!S.current){ P.joining=false; return; }
      const room=t.joinRoom({appId:"yunny-abyss-rpg-v1"},"ynd-abyss-plaza-1");
      const acts={};
      for(const a of ["hello","chat","dreq","dacc","dact","dsync","dend","rad","rjoin","rstate","ract","rend"])acts[a]=room.makeAction(a);
      P.room=room; P.acts=acts;
      const meNick=()=>S.current&&S.current.nick;
      acts.hello.onMessage=d=>{ if(!d||!d.nick||d.nick===meNick())return;
        const isNew=!P.peers[d.nick];
        P.peers[d.nick]={...d,ts:Date.now()};
        if(isNew)sendHello();
        bump(); };
      acts.chat.onMessage=d=>{ if(!d||!d.txt||!d.from||d.from===meNick())return;
        P.chat.push({...d,id:Date.now()+R()}); if(P.chat.length>60)P.chat.shift(); bump(); };
      acts.dreq.onMessage=d=>{ if(!d||d.to!==meNick()||P.duel)return; P.pending={from:d.from,st:d.st}; bump(); };
      acts.dacc.onMessage=d=>{ if(!d||d.to!==meNick())return; if(P.duel&&!P.duel.over)return;
        startDuel(d.st,true); bump(); };   // 내가 도전자 → 선공
      acts.dact.onMessage=d=>{ if(!d||d.to!==meNick())return; recvAct(d); };
      acts.dsync.onMessage=d=>{ if(!d||d.to!==meNick())return; const du=P.duel;
        if(du&&!du.over){
          du.oppHp=d.hp; du.lastAct=Date.now();
          if(d.ackTn&&du.pendingAct&&du.pendingAct.payload.tn===d.ackTn)du.pendingAct=null; // 재전송 큐 해제
          bump();
        } };
      acts.dend.onMessage=d=>{ if(!d||d.to!==meNick())return; finishDuel(d.winner); };
      acts.rad.onMessage=d=>{ if(!d||!d.rid||d.host===meNick())return; P.parties[d.rid]={...d,ts:Date.now()}; bump(); };
      acts.rjoin.onMessage=d=>{ if(!d||d.to!==meNick())return; hostAddMember(d); };
      acts.rstate.onMessage=d=>{ if(!d||!d.rid)return; memberOnState(d); };
      acts.ract.onMessage=d=>{ if(!d||d.to!==meNick())return; hostOnAct(d); };
      acts.rend.onMessage=d=>{ if(!d||!d.rid)return; onRaidEnd(d); };
      sendHello();
      P.joining=false; bump();
    });
  };
  const leavePlaza=()=>{
    const P=plaza.current;
    if(P.duel&&!P.duel.over&&P.acts){ try{ P.acts.dend.send({from:S.current.nick,to:P.duel.opp.nick,winner:P.duel.opp.nick}); }catch(e){} }
    if(P.raid&&P.raid.role==="host"&&P.acts){ try{ P.acts.rend.send({rid:P.raid.rid,result:"abort"}); }catch(e){} }
    if(P.room){ try{ P.room.leave(); }catch(e){} }
    plaza.current={room:null,acts:null,peers:{},chat:[],duel:null,pending:null,joining:false,raid:null,parties:{}};
    bump();
  };
  /* 하트비트: 8초마다 존재 알림 + 오래된 피어 정리 */
  useEffect(()=>{
    const iv=setInterval(()=>{
      const P=plaza.current;
      if(!P.room)return;
      sendHello();
      const now=Date.now();
      for(const k of Object.keys(P.peers)){ if(now-P.peers[k].ts>25000)delete P.peers[k]; }
      for(const k of Object.keys(P.parties)){ if(now-P.parties[k].ts>12000)delete P.parties[k]; }
      bump();
    },8000);
    return ()=>clearInterval(iv);
  },[]);
  /* 결투 재전송: 상대 ack(dsync) 미수신 시 2.5초마다 마지막 행동 재송신 (연결 순단 대비) */
  useEffect(()=>{
    const iv=setInterval(()=>{
      const P=plaza.current, du=P.duel;
      if(!P.room||!du||du.over||!du.pendingAct)return;
      const pa=du.pendingAct;
      if(Date.now()-pa.sentAt>2500&&pa.tries<10){ pa.tries++; pa.sentAt=Date.now(); P.acts.dact.send(pa.payload); }
    },1000);
    return ()=>clearInterval(iv);
  },[]);

  /* ---------- PvP 결투 ---------- */
  const dlog=(t,c)=>{ const du=plaza.current.duel; if(!du)return; du.log.unshift({t,c:c||"",id:"dl"+Date.now()+Math.floor(R()*1e6)}); if(du.log.length>30)du.log.length=30; };
  const startDuel=(oppSt,myTurn)=>{
    const P=plaza.current, st=calc(S.current);
    P.pending=null;
    P.duel={opp:oppSt,myHp:st.hp,myMax:st.hp,myMp:st.mp,myShield:0,buffs:[],
      oppHp:oppSt.hp,oppMax:oppSt.hp,myTurn,log:[],over:null,lastAct:Date.now(),
      turnNo:0,lastRecvTurn:0,pendingAct:null};
    dlog(`⚔️ ${oppSt.nick} (Lv.${oppSt.lv} ${oppSt.cname})와(과)의 결투 시작! ${myTurn?"선공입니다!":"상대가 선공입니다."}`,"g");
    tab.current="plaza";
  };
  const challenge=(nick)=>{
    const P=plaza.current; if(!P.room||P.duel)return;
    P.acts.dreq.send({from:S.current.nick,to:nick,st:pSnap()});
    say(`${nick}에게 결투 신청을 보냈습니다!`);
  };
  const acceptDuel=()=>{
    const P=plaza.current; if(!P.pending)return;
    const opp=P.pending;
    startDuel(opp.st,false);                               // 수락자는 후공
    P.acts.dacc.send({from:S.current.nick,to:opp.from,st:pSnap()});
    bump();
  };
  const declineDuel=()=>{ plaza.current.pending=null; bump(); };
  const duelAct=(skillId)=>{
    const P=plaza.current, du=P.duel;
    if(!du||du.over||!du.myTurn)return;
    const s=S.current, st=calc(s);
    let mult=1,sfx={},usedSkill=null,hits=1;
    if(skillId){
      const sk=SKILLS[skillId], slv=skillLearned(s,sk,skillId);
      if(!sk||!slv)return;
      if(du.myMp<sk.mp){ say("MP가 부족합니다!"); return; }
      du.myMp-=sk.mp; mult=sk.mult*(1+0.12*(slv-1)); sfx=sk.fx||{}; usedSkill=sk; hits=sk.hits||1;
      if(sk.cine)playCine(sk);
    }
    let total=0,anyCrit=false;
    if(!usedSkill||usedSkill.mult>0){
      const atkEff=st.atk*(1+du.buffs.filter(b=>b.k==="atk").reduce((a,b)=>a+b.v,0));
      const critCh=sfx.gcrit?100:st.crit+du.buffs.filter(b=>b.k==="critf").reduce((a,b)=>a+b.v,0)+(sfx.critB||0);
      for(let i=0;i<hits;i++){
        let m=mult;
        if(sfx.exec&&du.oppHp<=du.oppMax*sfx.exec.below)m=mult*sfx.exec.mult;
        const isCrit=R()*100<critCh; if(isCrit)anyCrit=true;
        let dmg=Math.max(1,Math.round((atkEff*m-du.opp.def)*(0.9+R()*0.2)));
        if(isCrit)dmg=Math.round(dmg*(st.critd+(sfx.critdB||0))/100);
        total+=dmg;
      }
      du.oppHp-=total;                                      // 낙관 반영 → dsync로 정정
      if(sfx.heal&&total>0)du.myHp=Math.min(du.myMax,du.myHp+Math.round(total*sfx.heal));
    }
    if(usedSkill){
      if(sfx.selfHeal){ du.myHp=Math.min(du.myMax,du.myHp+Math.round(du.myMax*sfx.selfHeal)); dlog("💞 HP 회복!","g"); }
      if(sfx.shield){ du.myShield=Math.max(du.myShield,Math.round(du.myMax*sfx.shield)); dlog("🔷 보호막 생성!","g"); }
      if(sfx.mpR)du.myMp=Math.min(st.mp,du.myMp+Math.round(st.mp*sfx.mpR));
      if(sfx.atkB){ du.buffs=du.buffs.filter(b=>b.k!=="atk"); du.buffs.push({k:"atk",v:sfx.atkB.v,t:sfx.atkB.t}); }
      if(sfx.critBf){ du.buffs=du.buffs.filter(b=>b.k!=="critf"); du.buffs.push({k:"critf",v:sfx.critBf.v,t:sfx.critBf.t}); }
    }
    du.myMp=Math.min(st.mp,du.myMp+Math.round(st.mp*0.05));
    du.buffs.forEach(b=>b.t--); du.buffs=du.buffs.filter(b=>b.t>0);
    if(total>0)dlog(`${usedSkill?usedSkill.icon+" ["+usedSkill.name+"]":"⚔️"} ${anyCrit?"치명타! ":""}${du.opp.nick}에게 ${fmt(total)} 피해`,anyCrit?"c":"");
    else if(usedSkill)dlog(`${usedSkill.icon} [${usedSkill.name}] 사용`,"g");
    du.myTurn=false; du.lastAct=Date.now();
    du.turnNo++;
    const payload={from:s.nick,to:du.opp.nick,tn:du.turnNo,name:usedSkill?usedSkill.name:"기본 공격",icon:usedSkill?usedSkill.icon:"⚔️",dmg:total,crit:anyCrit,hp:Math.max(0,du.myHp)};
    du.pendingAct={payload,sentAt:Date.now(),tries:0};      // dsync(ack) 수신 시 해제, 미수신 시 재전송
    P.acts.dact.send(payload);
    bump();
  };
  const recvAct=(d)=>{                                     // 상대 공격 수신 — 내 HP는 내가 권위
    const P=plaza.current, du=P.duel;
    if(!du||du.over)return;
    const s=S.current;
    if(d.tn&&d.tn<=du.lastRecvTurn){                        // 재전송 중복 → ack만 다시
      P.acts.dsync.send({from:s.nick,to:du.opp.nick,hp:Math.max(0,du.myHp),ackTn:d.tn});
      return;
    }
    if(d.tn)du.lastRecvTurn=d.tn;
    let dmg=d.dmg;
    if(du.myShield>0){ const ab=Math.min(du.myShield,dmg); du.myShield-=ab; dmg-=ab; }
    du.myHp-=dmg;
    if(d.hp!==undefined)du.oppHp=Math.min(du.oppMax,d.hp);
    dlog(`${d.icon} [${d.name}] ${d.crit?"치명타! ":""}${fmt(d.dmg)} 피해를 받음${dmg<d.dmg?" (일부 보호막 흡수)":""}`,"r");
    du.myTurn=true; du.lastAct=Date.now();
    P.acts.dsync.send({from:s.nick,to:du.opp.nick,hp:Math.max(0,du.myHp),ackTn:d.tn});
    if(du.myHp<=0){
      du.myHp=0;
      P.acts.dend.send({from:s.nick,to:du.opp.nick,winner:du.opp.nick});
      finishDuel(du.opp.nick);
      return;
    }
    bump();
  };
  const finishDuel=(winner)=>{
    const P=plaza.current, du=P.duel;
    if(!du||du.over)return;
    const s=S.current, won=winner===s.nick;
    du.over=won?"win":"lose"; du.myTurn=false;
    if(won){ s.pvpW++; const g=150*Math.max(1,du.opp.lv); s.gold+=g; log(`🏟️ [PvP] ${du.opp.nick}에게 승리! +${fmt(g)}G`,"g"); dlog(`🏆 승리! 보상 +${fmt(g)}G`,"g"); }
    else { s.pvpL++; log(`🏟️ [PvP] ${du.opp.nick}에게 패배…`,"r"); dlog("💀 패배…","r"); }
    commit(); sendHello();
  };
  const surrender=()=>{
    const P=plaza.current, du=P.duel;
    if(!du||du.over)return;
    P.acts.dend.send({from:S.current.nick,to:du.opp.nick,winner:du.opp.nick});
    finishDuel(du.opp.nick);
  };
  const claimTimeout=()=>{
    const P=plaza.current, du=P.duel;
    if(!du||du.over||du.myTurn)return;
    if(Date.now()-du.lastAct<30000)return;
    P.acts.dend.send({from:S.current.nick,to:du.opp.nick,winner:S.current.nick});
    finishDuel(S.current.nick);
  };
  const closeDuel=()=>{ plaza.current.duel=null; bump(); };
  const sendChat=()=>{
    const P=plaza.current, txt=chatIn.trim();
    if(!txt||!P.room)return;
    const msg={from:S.current.nick,txt:txt.slice(0,120),ts:Date.now()};
    P.chat.push({...msg,id:Date.now()+R()}); if(P.chat.length>60)P.chat.shift();
    P.acts.chat.send(msg); setChatIn(""); bump();
  };

  /* ================= 파티 레이드 (호스트 권위 · 최대 4인) ================= */
  const rlog=(t,c)=>{ const rd=plaza.current.raid; if(!rd)return; rd.log.unshift({t,c:c||"",id:"rl"+Date.now()+Math.floor(R()*1e6)}); if(rd.log.length>40)rd.log.length=40; };
  const openRaid=(bossId)=>{
    const P=plaza.current, s=S.current, B=RAID_MAP[bossId];
    if(!P.room||P.raid||P.duel)return;
    if(s.lv<B.lv){ say(`레벨 ${B.lv}부터 도전할 수 있습니다.`); return; }
    if(s.rticket<1){ say("레이드 입장권이 필요합니다! (시작 시 1장 소모)"); return; }
    const st=calc(s);
    P.raid={role:"host",rid:"r"+Date.now().toString(36)+Math.floor(R()*999),bossId,phase:"lobby",round:0,
      members:{[s.nick]:{nick:s.nick,icon:s.hcls?HID[s.hcls].icon:CLS[s.cls].icon,hp:st.hp,maxHp:st.hp,dead:false,dmg:0,total:0,acted:false,miss:0}},
      bossHp:0,bossMax:0,bossAtkRaw:0,enraged:false,roundStart:0,lastAd:0,lastBc:0,log:[],myMp:st.mp};
    rlog(`${B.icon} [${B.name}] 파티 모집 시작! 광장의 모험가들이 참가할 수 있습니다.`,"g");
    bump();
  };
  const joinRaidParty=(ad)=>{
    const P=plaza.current, s=S.current, B=RAID_MAP[ad.bossId];
    if(!P.room||P.raid||P.duel||!B)return;
    if(s.lv<B.lv){ say(`레벨 ${B.lv}부터 도전할 수 있습니다.`); return; }
    if(s.rticket<1){ say("레이드 입장권이 필요합니다! (시작 시 1장 소모)"); return; }
    const st=calc(s);
    P.raid={role:"member",rid:ad.rid,host:ad.host,bossId:ad.bossId,phase:"lobby",round:0,members:[],
      bossHp:0,bossMax:0,bossAtkRaw:0,enraged:false,myHp:st.hp,myMaxHp:st.hp,myDead:false,myActed:false,myMp:st.mp,
      lastState:Date.now(),lastRound:0,ticketPaid:false,log:[]};
    P.acts.rjoin.send({to:ad.host,from:s.nick,rid:ad.rid,icon:s.hcls?HID[s.hcls].icon:CLS[s.cls].icon,hp:st.hp,maxHp:st.hp});
    rlog(`${B.icon} [${B.name}] 파티에 참가 신청!`,"g");
    bump();
  };
  const broadcastRaid=()=>{
    const P=plaza.current, rd=P.raid;
    if(!rd||rd.role!=="host")return;
    rd.lastBc=Date.now();
    P.acts.rstate.send({rid:rd.rid,host:S.current.nick,bossId:rd.bossId,phase:rd.phase,round:rd.round,
      bossHp:rd.bossHp,bossMax:rd.bossMax,bossAtkRaw:rd.bossAtkRaw,enraged:rd.enraged,
      members:Object.values(rd.members).map(m=>({nick:m.nick,icon:m.icon,hp:m.hp,maxHp:m.maxHp,dead:m.dead,dmg:m.dmg,total:m.total})),
      log:rd.log.slice(0,6).map(l=>({t:l.t,c:l.c,id:l.id})),ts:Date.now()});
  };
  const hostAddMember=(d)=>{
    const P=plaza.current, rd=P.raid;
    if(!rd||rd.role!=="host"||rd.rid!==d.rid||rd.phase!=="lobby")return;
    if(Object.keys(rd.members).length>=4||rd.members[d.from])return;
    rd.members[d.from]={nick:d.from,icon:d.icon||"🧝",hp:d.hp,maxHp:d.maxHp,dead:false,dmg:0,total:0,acted:false,miss:0};
    rlog(`👋 ${d.from}이(가) 파티에 합류! (${Object.keys(rd.members).length}/4)`,"g");
    broadcastRaid(); bump();
  };
  const startRaid=()=>{
    const P=plaza.current, rd=P.raid, s=S.current;
    if(!rd||rd.role!=="host"||rd.phase!=="lobby")return;
    const B=RAID_MAP[rd.bossId], n=Object.keys(rd.members).length;
    s.rticket--; commit();
    rd.phase="fight"; rd.round=1; rd.roundStart=Date.now();
    rd.bossMax=Math.round(B.hp*n); rd.bossHp=rd.bossMax; rd.bossAtkRaw=0;
    rlog(`⚔️ 레이드 시작! [${B.name}] HP ${fmt(rd.bossMax)} · ${B.rounds}라운드 제한 · ${n}인 파티`,"r");
    broadcastRaid(); bump();
  };
  const memberOnState=(d)=>{
    const P=plaza.current, rd=P.raid, s=S.current;
    if(!rd||rd.role!=="member"||rd.rid!==d.rid)return;
    rd.lastState=Date.now();
    const wasLobby=rd.phase==="lobby";
    if(d.phase==="win"&&!rd.rewarded){ rd.rewarded=true; rlog("🏆 토벌 성공!!","g"); grantRaidReward(rd.bossId); }
    rd.phase=d.phase; rd.bossHp=d.bossHp; rd.bossMax=d.bossMax; rd.enraged=d.enraged; rd.members=d.members||[];
    if(d.log)d.log.forEach(l=>{ if(!rd.log.some(x=>x.id===l.id))rd.log.push(l); });
    rd.log.sort((a,b)=>(b.id>a.id?1:-1)); if(rd.log.length>40)rd.log.length=40;
    if(wasLobby&&d.phase==="fight"&&!rd.ticketPaid){ rd.ticketPaid=true; s.rticket=Math.max(0,s.rticket-1); commit(); }
    if(d.phase==="fight"&&d.round>rd.lastRound){
      rd.lastRound=d.round; rd.round=d.round; rd.myActed=false;
      if(d.bossAtkRaw>0&&!rd.myDead){
        const st=calc(s);
        const dmg=Math.max(1,Math.round(d.bossAtkRaw-st.def*0.55));
        rd.myHp-=dmg;
        rlog(`🩸 보스의 광역 공격! -${fmt(dmg)}`,"r");
        if(rd.myHp<=0){ rd.myHp=0; rd.myDead=true; rlog("💀 당신은 쓰러졌습니다…","r"); }
      }
      const st2=calc(s);
      rd.myMp=Math.min(st2.mp,rd.myMp+Math.round(st2.mp*0.06));
    }
    bump();
  };
  const raidAct=(skillId)=>{
    const P=plaza.current, rd=P.raid, s=S.current;
    if(!rd||rd.phase!=="fight")return;
    const B=RAID_MAP[rd.bossId], st=calc(s);
    const isHost=rd.role==="host";
    const meObj=isHost?rd.members[s.nick]:null;
    const meDead=isHost?meObj.dead:rd.myDead;
    const meActed=isHost?meObj.acted:rd.myActed;
    if(meDead||meActed)return;
    let mult=1,sfx={},usedSkill=null,hits=1;
    if(skillId){
      const sk=SKILLS[skillId], slv=skillLearned(s,sk,skillId);
      if(!sk||!slv)return;
      if(rd.myMp<sk.mp){ say("MP가 부족합니다!"); return; }
      rd.myMp-=sk.mp; mult=sk.mult*(1+0.12*(slv-1)); sfx=sk.fx||{}; usedSkill=sk; hits=sk.hits||1;
      if(sk.cine)playCine(sk);
    }
    let total=0,anyCrit=false;
    if(!usedSkill||usedSkill.mult>0){
      const critCh=sfx.gcrit?100:st.crit+(sfx.critB||0);
      for(let i=0;i<hits;i++){
        let m=mult;
        if(sfx.exec&&rd.bossHp<=rd.bossMax*sfx.exec.below)m=mult*sfx.exec.mult;
        const isCrit=R()*100<critCh; if(isCrit)anyCrit=true;
        let dmg=Math.max(1,Math.round((st.atk*m-B.def)*(0.9+R()*0.2)));
        if(isCrit)dmg=Math.round(dmg*(st.critd+(sfx.critdB||0))/100);
        total+=dmg;
      }
    }
    let myHp=isHost?meObj.hp:rd.myHp;
    const myMax=isHost?meObj.maxHp:rd.myMaxHp;
    if(usedSkill){
      if(sfx.heal&&total>0)myHp=Math.min(myMax,myHp+Math.round(total*sfx.heal));
      if(sfx.selfHeal)myHp=Math.min(myMax,myHp+Math.round(myMax*sfx.selfHeal));
    }
    rd.myMp=Math.min(st.mp,rd.myMp+Math.round(st.mp*0.04));
    if(isHost){
      meObj.dmg=total; meObj.total+=total; meObj.acted=true; meObj.hp=myHp; meObj.miss=0;
      rlog(`${usedSkill?usedSkill.icon+" ["+usedSkill.name+"]":"⚔️"} ${anyCrit?"치명타! ":""}${s.nick} → 보스에게 ${fmt(total)}`,anyCrit?"c":"");
    }else{
      rd.myHp=myHp; rd.myActed=true;
      P.acts.ract.send({to:rd.host,from:s.nick,rid:rd.rid,round:rd.round,dmg:total,hp:myHp,maxHp:myMax,dead:rd.myDead,
        name:usedSkill?usedSkill.name:"기본 공격",icon:usedSkill?usedSkill.icon:"⚔️",crit:anyCrit});
      rlog(`${usedSkill?usedSkill.icon+" ["+usedSkill.name+"]":"⚔️"} ${anyCrit?"치명타! ":""}보스에게 ${fmt(total)} (전송)`,anyCrit?"c":"");
    }
    bump();
  };
  const hostOnAct=(d)=>{
    const P=plaza.current, rd=P.raid;
    if(!rd||rd.role!=="host"||rd.rid!==d.rid)return;
    const m=rd.members[d.from];
    if(!m||rd.phase!=="fight"||d.round!==rd.round||m.acted)return;
    m.acted=true; m.dmg=d.dmg; m.total+=d.dmg; m.hp=d.hp; m.maxHp=d.maxHp||m.maxHp; m.dead=d.dead||d.hp<=0; m.miss=0;
    rlog(`${d.icon} [${d.name}] ${d.crit?"치명타! ":""}${d.from} → 보스에게 ${fmt(d.dmg)}`,d.crit?"c":"");
    bump();
  };
  const hostResolve=()=>{
    const P=plaza.current, rd=P.raid, s=S.current;
    if(!rd||rd.role!=="host"||rd.phase!=="fight")return;
    const B=RAID_MAP[rd.bossId];
    for(const m of Object.values(rd.members)){
      if(!m.dead&&!m.acted){ m.miss=(m.miss||0)+1; m.dmg=0;
        if(m.miss>=2){ m.dead=true; rlog(`📡 ${m.nick}의 응답이 없어 이탈 처리되었습니다.`,"r"); } }
    }
    const sum=Object.values(rd.members).reduce((a,m)=>a+(m.dead?0:m.dmg),0);
    rd.bossHp=Math.max(0,rd.bossHp-sum);
    if(sum>0)rlog(`💥 파티 총 피해 ${fmt(sum)} — 보스 HP ${fmt(rd.bossHp)}`,"d");
    if(rd.bossHp<=0){
      rd.phase="win"; rd.bossAtkRaw=0;
      rlog(`🏆 [${B.name}] 토벌 성공!!`,"g");
      broadcastRaid();
      P.acts.rend.send({rid:rd.rid,result:"win"});
      grantRaidReward(rd.bossId);
      bump(); return;
    }
    if(!rd.enraged&&rd.bossHp<=rd.bossMax*0.5){ rd.enraged=true; rlog(`😡 [${B.name}]이(가) 격노했다! 공격력 +70%!`,"r"); }
    if(rd.round>=B.rounds){
      rd.phase="fail"; rlog("⏳ 라운드 제한 초과… 토벌 실패.","r");
      broadcastRaid();
      P.acts.rend.send({rid:rd.rid,result:"fail"});
      bump(); return;
    }
    rd.bossAtkRaw=Math.round(B.atk*(rd.enraged?1.7:1)*(0.9+R()*0.2));
    const st=calc(s), me=rd.members[s.nick];
    if(me&&!me.dead){
      const dmg=Math.max(1,Math.round(rd.bossAtkRaw-st.def*0.55));
      me.hp-=dmg;
      rlog(`🩸 보스의 광역 공격! -${fmt(dmg)}`,"r");
      if(me.hp<=0){ me.hp=0; me.dead=true; rlog("💀 당신은 쓰러졌습니다…","r"); }
    }
    if(Object.values(rd.members).every(m=>m.dead)){
      rd.phase="fail"; rlog("💀 파티가 전멸했다…","r");
      broadcastRaid();
      P.acts.rend.send({rid:rd.rid,result:"fail"});
      bump(); return;
    }
    rd.round++; rd.roundStart=Date.now();
    for(const m of Object.values(rd.members))m.acted=false;
    broadcastRaid(); bump();
  };
  const onRaidEnd=(d)=>{
    const P=plaza.current, rd=P.raid;
    if(!rd||rd.role!=="member"||rd.rid!==d.rid)return;
    if(d.result==="win"){ rd.phase="win"; if(!rd.rewarded){ rd.rewarded=true; rlog("🏆 토벌 성공!!","g"); grantRaidReward(rd.bossId); } }
    else if(d.result==="fail"&&rd.phase!=="fail"){ rd.phase="fail"; rlog("💀 토벌 실패…","r"); }
    else if(d.result==="abort"){ rd.phase="fail"; rlog("📡 호스트가 파티를 해산했습니다.","r"); }
    bump();
  };
  const grantRaidReward=(bossId)=>{
    const s=S.current, B=RAID_MAP[bossId];
    const xp=Math.round(needXp(B.lv)/5), gold=Math.round(Math.pow(B.lv,2.6)*20);
    s.gold+=gold; s.stone+=50; s.rticket+=1;
    const pool=TIER_POOL[6]; const tid=pool[Math.floor(R()*pool.length)]; addItem(tid);
    const types=Object.keys(RUNE_T); addRune(types[Math.floor(R()*types.length)],6);
    log(`🏆 [레이드] ${B.name} 토벌! +${fmt(xp)}XP +${fmt(gold)}G, [신화] ${ITEMS[tid].name}, 전설 룬, 강화석 50, 🎟️ 반환!`,"g");
    gainXp(xp);
    checkHidden(); checkPromo(); commit();
  };
  const leaveRaid=()=>{
    const P=plaza.current, rd=P.raid;
    if(!rd)return;
    if(rd.role==="host"&&rd.phase!=="win"&&rd.phase!=="fail"){ try{ P.acts.rend.send({rid:rd.rid,result:"abort"}); }catch(e){} }
    P.raid=null; bump();
  };
  /* 레이드 틱: 호스트 라운드 해결/광고 재송신, 멤버 호스트 응답 감시 */
  useEffect(()=>{
    const iv=setInterval(()=>{
      const P=plaza.current, rd=P.raid;
      if(!P.room||!rd)return;
      const now=Date.now();
      if(rd.role==="host"){
        if(rd.phase==="lobby"&&now-rd.lastAd>4000){ rd.lastAd=now;
          P.acts.rad.send({rid:rd.rid,host:S.current.nick,bossId:rd.bossId,n:Object.keys(rd.members).length,open:true}); }
        if(rd.phase==="fight"){
          const alive=Object.values(rd.members).filter(m=>!m.dead);
          if(alive.length&&alive.every(m=>m.acted))hostResolve();
          else if(now-rd.roundStart>25000)hostResolve();
          else if(now-rd.lastBc>5000)broadcastRaid();
        }
      } else if(rd.phase==="fight"&&now-rd.lastState>30000){
        rd.phase="fail"; rlog("📡 호스트의 응답이 없습니다… 레이드 중단.","r");
      }
      bump();
    },1000);
    return ()=>clearInterval(iv);
  },[]);

  /* ================= UI 헬퍼 ================= */
  const Bar=(cur,max,col,h)=>(
    <div className="w-full rounded-full overflow-hidden" style={{background:"rgba(0,0,0,.5)",height:h||10}}>
      <div className="h-full rounded-full transition-all" style={{width:clamp(cur/max*100,0,100)+"%",background:col}}/>
    </div>
  );
  const itemLabel=(it)=>{
    const t=ITEMS[it.t];
    return <span style={{color:TIER_COL[t.tier]}}>{t.icon} {t.name}{it.plus>0?` +${it.plus}`:""}{it.dmg?" 🔻손상":""}</span>;
  };
  const itemStats=(it)=>{
    const t=ITEMS[it.t]; const m=(1+0.12*it.plus)*(it.dmg?0.5:1); const parts=[];
    if(t.atk)parts.push("공격 "+Math.round(t.atk*m));
    if(t.def)parts.push("방어 "+Math.round(t.def*m));
    if(t.hp)parts.push("HP "+Math.round(t.hp*m));
    if(t.mp)parts.push("MP "+Math.round(t.mp*m));
    if(t.crit)parts.push("치명 "+(t.crit*m).toFixed(1)+"%");
    if(t.critd)parts.push("치피 "+Math.round(t.critd*m)+"%");
    return parts.join(" · ");
  };

  /* ================= 화면: 로그인 ================= */
  const renderLogin=()=>(
    <div className="min-h-screen flex items-center justify-center p-4 fadein" style={{background:"radial-gradient(ellipse at 50% 30%, #1c1420 0%, #0b0a0d 70%)"}}>
      <div className="panel p-8 w-full max-w-sm text-center pop">
        <div className="text-5xl mb-2">🩸</div>
        <h1 className="text-2xl font-black text-red-400 glow">나락의 심연</h1>
        <p className="text-xs text-zinc-400 mt-1 mb-5">하드코어 다크 판타지 RPG — 극악의 성장, 끝없는 파밍</p>
        <input value={nick} onChange={e=>setNick(e.target.value)} placeholder="닉네임"
          className="w-full mb-2 px-4 py-2.5 rounded-lg bg-black/50 border border-zinc-700 text-sm"/>
        <input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="비밀번호"
          onKeyDown={e=>{if(e.key==="Enter")doLogin();}}
          className="w-full mb-3 px-4 py-2.5 rounded-lg bg-black/50 border border-zinc-700 text-sm"/>
        {err&&<p className="text-xs text-red-400 mb-2">{err}</p>}
        <div className="flex gap-2">
          <button onClick={doLogin} className="btn flex-1 py-2.5 rounded-lg font-bold bg-red-700 text-white text-sm">⚔️ 로그인</button>
          <button onClick={doCreate} className="btn flex-1 py-2.5 rounded-lg font-bold bg-zinc-700 text-white text-sm">✨ 신규 생성</button>
        </div>
        {accounts().length>0&&(
          <div className="mt-4 text-left">
            <div className="text-[11px] text-zinc-500 mb-1">이 브라우저의 계정</div>
            <div className="flex flex-wrap gap-1.5">
              {accounts().map(n=>(
                <button key={n} onClick={()=>setNick(n)} className="btn px-2.5 py-1 rounded-md bg-zinc-800 text-xs text-amber-300">{n}</button>
              ))}
            </div>
          </div>
        )}
        <p className="text-[10px] text-zinc-600 mt-4">모든 데이터는 이 브라우저(localStorage)에 저장됩니다.</p>
      </div>
    </div>
  );

  /* ================= 화면: 직업 선택 ================= */
  const renderCreate=()=>(
    <div className="min-h-screen flex items-center justify-center p-4 fadein" style={{background:"radial-gradient(ellipse at 50% 30%, #1c1420 0%, #0b0a0d 70%)"}}>
      <div className="w-full max-w-5xl text-center">
        <h1 className="text-xl font-black text-amber-300 mb-1">운명을 선택하라, {pend.current&&pend.current.nick}</h1>
        <p className="text-xs text-zinc-500 mb-4">13개의 길 — 각 직업은 500개의 스킬 계열과 5개의 전설 스킬, 그리고 숨겨진 전직의 길을 품고 있다.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {Object.entries(CLS).map(([cid,c])=>(
            <button key={cid} onClick={()=>pickClass(cid)} className="btn panel p-3 text-left hover:border-red-500/40">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{c.icon}</span>
                <span className="font-black text-red-300 text-sm">{c.name}</span>
                <span className="text-[8px] text-zinc-600 ml-auto">{c.grp==="warrior"?"전사계":c.grp==="mage"?"마법계":"암살계"}</span>
              </div>
              <p className="text-[10px] text-zinc-400 leading-snug mb-1.5 min-h-[26px]">{c.desc}</p>
              <div className="text-[9px] text-zinc-500">❤️{c.base.hp} 💧{c.base.mp} ⚔️{c.base.atk} 🛡️{c.base.def} 🎯{c.base.crit}% 💥{c.base.critd}%</div>
            </button>
          ))}
        </div>
        <button onClick={()=>{scr.current="login";bump();}} className="btn mt-4 px-4 py-2 rounded-lg bg-zinc-800 text-xs text-zinc-400">← 돌아가기</button>
      </div>
    </div>
  );

  /* ================= 탭 콘텐츠 ================= */
  const renderHunt=(s,st)=>{
    const map=MAPS[s.map], mon=s.combat.mon, c=s.combat;
    const learned=loadoutSkills(s);
    const hasStatus=c.buffs.length>0||c.shield>0||c.pdots.length>0||c.pstun;
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm font-bold">{map.icon} {map.name} <span className="text-[10px] text-zinc-500">권장 Lv.{map.lv}</span></div>
          {s.mode==="dungeon"&&s.dungeon&&<span className="text-xs font-bold text-purple-300 pop">{DG_MAP[s.dungeon.id].i} {DG_MAP[s.dungeon.id].n} — 웨이브 {s.dungeon.wave}/{dgWaves(s.dungeon.id)} {DG_MAP[s.dungeon.id].mod!=="none"&&<span className="text-[10px]">({MODS[DG_MAP[s.dungeon.id].mod].icon}{MODS[DG_MAP[s.dungeon.id].mod].n})</span>}</span>}
          {s.mode==="boss"&&<span className="text-xs font-bold text-red-400 pop">👹 보스전 · 남은 턴 {s.boss.turns}</span>}
          <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
            <input type="checkbox" checked={s._auto} onChange={()=>{s._auto=!s._auto;bump();}}/>
            자동 사냥 {(()=>{const rid=s.autoSkill?resolveEntry(s,s.autoSkill):null;return rid&&SKILLS[rid]?`(${SKILLS[rid].name})`:"(기본 공격)";})()}
          </label>
        </div>
        {hasStatus&&(
          <div className="flex flex-wrap gap-1">
            {c.shield>0&&<span className="chip" style={{background:"rgba(34,211,238,.15)",color:"#67e8f9"}}>🔷 보호막 {fmt(c.shield)}</span>}
            {c.buffs.map(b=><span key={b.k} className="chip" style={{background:"rgba(52,211,153,.15)",color:"#6ee7b7"}}>{b.icon} {b.name} · {b.t}턴</span>)}
            {c.pdots.map(d=><span key={d.k} className="chip" style={{background:"rgba(239,68,68,.15)",color:"#fca5a5"}}>{d.k==="burn"?"🔥 화상":"☠️ 중독"} · {d.t}턴</span>)}
            {c.pstun&&<span className="chip" style={{background:"rgba(250,204,21,.15)",color:"#fde047"}}>💫 충격 (다음 공격 -50%)</span>}
          </div>
        )}
        {mon?(
          <div className="panel p-4">
            <div className="flex items-center gap-4">
              <div className="relative" style={{width:56}}>
                <div key={"lg"+monLunge.current} className={monLunge.current>0?"lunge":""}>
                  <div key={"sk"+shakeK.current} className={"text-5xl "+(shakeK.current>0?"shake":"")}>{mon.tpl.icon}</div>
                </div>
                {atkFx.current&&(
                  <div key={"af"+atkFx.current.key} className="atk-layer">
                    {atkFx.current.kind==="slash"&&<div className="fx-slash"/>}
                    {atkFx.current.kind==="multi"&&Array.from({length:atkFx.current.n}).map((_,i)=>(
                      <div key={i} className="fx-slash" style={{animationDelay:(i*0.11)+"s",transform:"rotate("+(-28+i*26)+"deg)"}}/>
                    ))}
                    {atkFx.current.kind==="burst"&&<div className="fx-burst"/>}
                    <div className="fx-impact"/>
                  </div>
                )}
                {fx.current.map(f=>(
                  <span key={f.id} className="dfloat text-sm" style={{color:f.col,left:(f.x-16)+"px",top:"-8px"}}>{f.txt}</span>
                ))}
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-sm font-bold">
                  <span>{mon.tpl.name}{c.stun?" 💫":""}</span>
                  <span className="text-zinc-400">{fmt(Math.max(0,mon.hp))}/{fmt(mon.maxHp)}</span>
                </div>
                <div className="mt-1">{Bar(mon.hp,mon.maxHp,"linear-gradient(90deg,#ef4444,#b91c1c)",12)}</div>
                <div className="text-[11px] text-zinc-500 mt-1">공격 {fmt(mon.tpl.atk)} · 방어 {fmt(mon.tpl.def)} · 보상 {fmt(mon.tpl.xp)}XP/{fmt(mon.tpl.gold)}G</div>
                {((mon.tpl.mech||[]).length>0||mon.shield>0||mon.dots.length>0||mon.deb)&&(
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(mon.tpl.mech||[]).map(m=><span key={m} className="chip" title={MECH[m].d} style={{background:"rgba(239,68,68,.15)",color:"#fca5a5"}}>{MECH[m].icon} {MECH[m].n}</span>)}
                    {mon.shield>0&&<span className="chip" style={{background:"rgba(148,163,184,.2)",color:"#cbd5e1"}}>🛡️ {fmt(mon.shield)}</span>}
                    {mon.dots.map(d=><span key={d.k} className="chip" style={{background:"rgba(163,230,53,.15)",color:"#bef264"}}>{d.k==="burn"?"🔥":"☠️"} {fmt(d.dmg)}×{d.t}턴</span>)}
                    {mon.deb&&<span className="chip" style={{background:"rgba(251,191,36,.15)",color:"#fcd34d"}}>😤 공격 -{Math.round(mon.deb.v*100)}% · {mon.deb.t}턴</span>}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <button onClick={()=>playerTurn(null)} className="btn px-4 py-2 rounded-lg bg-red-700 text-white text-sm font-bold">⚔️ 공격</button>
              {learned.map(id=>{
                const sk=SKILLS[id];
                return <button key={id} onClick={()=>playerTurn(id)} disabled={s.mp<sk.mp}
                  className="btn px-3 py-2 rounded-lg bg-indigo-800 text-white text-xs font-bold">{sk.icon} {sk.name} <span className="text-indigo-300">MP{sk.mp}</span></button>;
              })}
              <button onClick={flee} className="btn px-3 py-2 rounded-lg bg-zinc-700 text-xs">🏃 {s.mode==="hunt"?"물러나기":"후퇴"}</button>
            </div>
          </div>
        ):(
          <div className="panel p-4">
            <div className="text-xs text-zinc-400 mb-2">사냥할 몬스터를 선택하세요:</div>
            <div className="flex flex-wrap gap-2">
              {map.mons.map(mid=>{
                const m=MONS[mid];
                return <button key={mid} onClick={()=>{spawn(mid);commit();}}
                  className="btn panel px-4 py-3 text-sm">{m.icon} {m.name}<div className="text-[10px] text-zinc-500">HP {fmt(m.hp)} · {fmt(m.xp)}XP</div></button>;
              })}
            </div>
          </div>
        )}
        <div className="panel p-3 h-48 overflow-y-auto text-[12px] leading-relaxed">
          {s.log.length===0&&<div className="text-zinc-600">전투 기록이 여기에 표시됩니다…</div>}
          {s.log.map(l=>(
            <div key={l.id} className={l.cls==="r"?"text-red-400":l.cls==="g"?"text-emerald-300":l.cls==="d"?"text-amber-300":l.cls==="c"?"text-yellow-300 font-bold":"text-zinc-300"}>{l.txt}</div>
          ))}
        </div>
      </div>
    );
  };

  const npcLine=useRef({});
  const renderPortal=(s)=>{
    const map=MAPS[s.map];
    const myW=map.w||1;
    return (
      <div className="space-y-3">
        <div className="panel p-4">
          <div className="text-lg font-black">{map.icon} {map.name} {map.region&&<span className="text-[10px] text-purple-300 font-normal">— {map.region}</span>} <span className="text-[10px] text-cyan-300 font-normal">· {WORLDS.find(x=>x.w===myW).name}</span></div>
          <div className="text-[11px] text-zinc-500">권장 레벨 {fmt(map.lv)} · 방문 {s.visits[s.map]||1}회 · 전체 맵 {Object.keys(MAPS).length}곳</div>
          <div className="text-[11px] text-zinc-400 mt-2">서식 몬스터: {map.mons.map(m=>MONS[m].icon+" "+MONS[m].name).join(", ")}</div>
          {map.boss&&<div className="text-[11px] text-red-400 mt-1">👹 지역 보스: {BOSSES[map.boss].name}</div>}
        </div>
        <div className="panel p-3">
          <div className="text-xs font-bold text-emerald-300 mb-2">🧑‍🤝‍🧑 이 지역의 NPC — 말을 걸어보세요</div>
          <div className="space-y-1.5">
            {(NPCS[s.map]||[]).map((np,i)=>{
              const key=s.map+"_"+i, li=npcLine.current[key]||0;
              return (
                <div key={key} className="flex items-start gap-2 bg-white/5 rounded-lg px-3 py-2">
                  <button onClick={()=>{npcLine.current[key]=(li+1)%np.lines.length;bump();}} className="btn px-2 py-1 rounded-md bg-emerald-900/60 text-[11px] font-bold shrink-0">{np.icon} {np.name}</button>
                  <div className="text-[11px] text-amber-100/80 italic pt-1">"{np.lines[li]}"</div>
                </div>
              );
            })}
          </div>
          <div className="text-[9px] text-zinc-600 mt-1.5">이름을 클릭하면 다음 대사를 들을 수 있습니다.</div>
        </div>
        <div className="panel p-3">
          <div className="text-xs font-bold text-cyan-300 mb-2">🌐 차원 관문 — 세 개의 세계</div>
          <div className="grid md:grid-cols-3 gap-2">
            {WORLDS.map(W=>{
              const here=myW===W.w, locked=s.lv<W.lv;
              return (
                <div key={W.w} className={"panel p-3 "+(here?"border-cyan-400/50":locked?"opacity-55":"")}>
                  <div className="text-sm font-black">{W.icon} {W.name} {here&&<span className="text-[9px] text-cyan-300">(현재)</span>}</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5 min-h-[28px]">{W.desc}</div>
                  <button onClick={()=>travelWorld(W.w)} disabled={here||locked||s.mode!=="hunt"}
                    className="btn w-full mt-1.5 py-1.5 rounded-lg bg-cyan-900 text-[11px] font-bold">{locked?`🔒 Lv.${W.lv} 필요`:here?"현재 위치":"이동"}</button>
                </div>
              );
            })}
          </div>
        </div>
        <div className="text-xs text-zinc-400 font-bold">🌀 연결된 포탈</div>
        <div className="grid md:grid-cols-3 gap-2">
          {map.portals.map(mid=>{
            const m=MAPS[mid];
            return <button key={mid} onClick={()=>usePortal(mid)} className="btn panel p-4 text-left">
              <div className="text-2xl">{m.icon}</div>
              <div className="font-bold text-sm mt-1">{m.name}</div>
              <div className="text-[10px] text-zinc-500">권장 Lv.{fmt(m.lv)} {s.lv<m.lv?"⚠️ 위험":""}</div>
            </button>;
          })}
        </div>
      </div>
    );
  };

  const renderDungeon=(s)=>(
    <div className="space-y-3">
      <div className="panel p-3 flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs text-zinc-400">🗝️ 입장권 <b className="text-amber-300">{s.dkey}</b> — 총 30개 던전, 각기 다른 규칙(수식어). 도중 사망 시 보상 없음!</div>
        <button onClick={()=>{const cc=400; if(S.current.gold<cc){say("골드 부족!");return;} S.current.gold-=cc; S.current.dkey++; log("🗝️ 던전 입장권 구매 (-400G)"); commit();}}
          className="btn px-3 py-1.5 rounded-lg bg-zinc-700 text-xs">입장권 구매 (400G)</button>
      </div>
      {[1,2,3,4,5,6].map(t=>(
        <div key={t}>
          <div className="text-xs font-bold text-purple-300 mb-1.5">🕳️ 티어 {t} <span className="text-zinc-500 font-normal">권장 Lv.{DG_LV[t]}+ · 보상 강화석 {4+2*t}, 룬 [{GRADE[clamp(t,1,6)]}]</span></div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2 mb-3">
            {DGS.filter(d=>d.t===t).map(d=>{
              const M=MODS[d.mod], locked=s.lv<d.lvq, clears=s.dgClears[d.id]||0;
              return (
                <div key={d.id} className={"panel p-3 "+(locked?"opacity-50":"")}>
                  <div className="flex justify-between items-start">
                    <div className="text-sm font-bold">{d.i} {d.n}</div>
                    {clears>0&&<span className="text-[9px] text-emerald-400 font-bold">✓{clears}회</span>}
                  </div>
                  <div className="mt-1"><span className="chip" style={{background:"rgba(147,51,234,.18)",color:"#d8b4fe"}}>{M.icon} {M.n}</span></div>
                  <div className="text-[10px] text-zinc-500 mt-1 min-h-[26px]">{M.d}</div>
                  <button onClick={()=>enterDungeon(d.id)} disabled={locked||s.mode!=="hunt"||s.dkey<1}
                    className="btn w-full mt-1.5 py-1.5 rounded-lg bg-purple-800 text-xs font-bold">{locked?`🔒 Lv.${d.lvq} 필요`:"입장 (🗝️1)"}</button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  const renderBoss=(s)=>(
    <div className="space-y-3">
      <div className="panel p-3 flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs text-zinc-400">🎟️ 입장권 <b className="text-red-300">{s.rticket}</b> — 총 35마리 보스. 기믹을 읽고 스킬로 공략하세요. 턴 제한 초과 시 실패!</div>
        <button onClick={()=>{const cc=900; if(S.current.gold<cc){say("골드 부족!");return;} S.current.gold-=cc; S.current.rticket++; log("🎟️ 레이드 입장권 구매 (-900G)"); commit();}}
          className="btn px-3 py-1.5 rounded-lg bg-zinc-700 text-xs">입장권 구매 (900G)</button>
      </div>
      {[1,2,3,4,5,6,7].map(t=>(
        <div key={t}>
          <div className="text-xs font-bold text-red-300 mb-1.5">👹 티어 {t} <span className="text-zinc-500 font-normal">Lv.{BT[t].lvq}+ · 확정 [{TIER_NAME[BOSS_ITEM_T[t]]}] 장비 + [{GRADE[clamp(t>=7?6:t+1,1,6)]}] 룬</span></div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2 mb-3">
            {BOSS_LIST.filter(b=>b.tier===t).map(b=>{
              const locked=s.lv<b.lvq, kills=s.bossKills[b.id]||0;
              return (
                <div key={b.id} className={"panel p-3 "+(locked?"opacity-50":"")}>
                  <div className="flex justify-between items-start">
                    <div className="text-sm font-bold">{b.icon} {b.name}</div>
                    {kills>0&&<span className="text-[9px] text-emerald-400 font-bold">✓{kills}회</span>}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">HP {fmt(b.hp)} · 공격 {fmt(b.atk)} · {b.turns}턴 제한</div>
                  <div className="flex flex-wrap gap-1 mt-1 min-h-[20px]">
                    {b.mech.map(m=><span key={m} className="chip" title={MECH[m].d} style={{background:"rgba(239,68,68,.15)",color:"#fca5a5"}}>{MECH[m].icon} {MECH[m].n}</span>)}
                    {b.mech.length===0&&<span className="text-[9px] text-zinc-600">기믹 없음</span>}
                  </div>
                  <button onClick={()=>enterBoss(b.id)} disabled={locked||s.mode!=="hunt"||s.rticket<1}
                    className="btn w-full mt-1.5 py-1.5 rounded-lg bg-red-800 text-xs font-bold">{locked?`🔒 Lv.${b.lvq} 필요`:"⚔️ 도전 (🎟️1)"}</button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  const renderForge=(s)=>(
    <div className="space-y-2">
      <div className="text-xs text-zinc-400">⚒️ 골드와 강화석으로 장비를 강화합니다. 단계가 오를수록 성공률이 떨어지고, +5 이상 실패 시 장비가 손상될 수 있습니다(수리 필요).</div>
      {allItems().length===0&&<div className="panel p-5 text-center text-sm text-zinc-500">강화할 장비가 없습니다.</div>}
      {allItems().map(({inst,eq})=>{
        const t=ITEMS[inst.t];
        const gold=80*(inst.plus+1)*(inst.plus+1), stones=Math.ceil((inst.plus+1)/2);
        const rate=Math.max(0.08,1-inst.plus*0.08);
        return (
          <div key={inst.uid} className="panel p-3 flex items-center justify-between gap-2 flex-wrap">
            <div>
              <div className="text-sm font-bold">{itemLabel(inst)} {eq&&<span className="text-[10px] text-emerald-400">[장착중·{SLOT_NAME[eq]}]</span>}</div>
              <div className="text-[11px] text-zinc-500">{itemStats(inst)}</div>
            </div>
            <div className="flex items-center gap-2">
              {inst.dmg&&<button onClick={()=>repair(inst.uid)} className="btn px-3 py-1.5 rounded-lg bg-cyan-800 text-xs">🔧 수리 ({fmt(150*t.tier)}G)</button>}
              <div className="text-[10px] text-zinc-500 text-right">성공률 {(rate*100).toFixed(0)}%<br/>{fmt(gold)}G + 🪨{stones}</div>
              <button onClick={()=>enhance(inst.uid)} disabled={inst.plus>=15} className="btn px-3 py-1.5 rounded-lg bg-amber-700 text-xs font-bold">⚒️ 강화</button>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderRune=(s)=>(
    <div className="space-y-3">
      <div className="panel p-3">
        <div className="text-xs font-bold text-zinc-300 mb-2">장착 룬 슬롯 (4)</div>
        <div className="grid grid-cols-4 gap-2">
          {s.runeEq.map((uid,i)=>{
            const r=uid?s.runes.find(x=>x.uid===uid):null;
            return (
              <button key={i} onClick={()=>r&&unequipRune(i)} className="btn panel p-2 text-center min-h-[64px]">
                {r?(<div><div className="text-lg">{RUNE_T[r.ty].icon}</div><div className="text-[10px]" style={{color:GRADE_COL[r.g]}}>{GRADE[r.g]}</div><div className="text-[9px] text-zinc-500">+{RUNE_T[r.ty].v(r.g)} {RUNE_T[r.ty].stat}</div></div>)
                 :(<div className="text-zinc-600 text-xs">비어있음</div>)}
              </button>
            );
          })}
        </div>
        <div className="text-[10px] text-zinc-500 mt-1">장착된 룬을 클릭하면 해제됩니다.</div>
      </div>
      <div className="text-xs text-zinc-400">💠 보유 룬 — [장착] 또는 [합성 선택] 후 같은 종류·등급 룬을 한 번 더 선택하면 상위 등급으로 합성됩니다.</div>
      {s.runes.filter(r=>!s.runeEq.includes(r.uid)).length===0&&<div className="panel p-4 text-center text-sm text-zinc-500">보유 중인 룬이 없습니다. 몬스터를 사냥해 보세요.</div>}
      <div className="grid md:grid-cols-2 gap-2">
        {s.runes.filter(r=>!s.runeEq.includes(r.uid)).map(r=>(
          <div key={r.uid} className={"panel p-3 flex items-center justify-between "+(fuseSel.current===r.uid?"border-amber-400/70":"")}>
            <div>
              <div className="text-sm font-bold" style={{color:GRADE_COL[r.g]}}>{RUNE_T[r.ty].icon} [{GRADE[r.g]}] {RUNE_T[r.ty].name}</div>
              <div className="text-[11px] text-zinc-500">+{RUNE_T[r.ty].v(r.g)} {RUNE_T[r.ty].stat}</div>
            </div>
            <div className="flex gap-1.5">
              <button onClick={()=>equipRune(r.uid)} className="btn px-2.5 py-1 rounded-md bg-emerald-800 text-[11px]">장착</button>
              <button onClick={()=>fuseClick(r.uid)} className={"btn px-2.5 py-1 rounded-md text-[11px] "+(fuseSel.current===r.uid?"bg-amber-500 text-black font-bold":"bg-indigo-800")}>{fuseSel.current===r.uid?"선택됨":"합성"}</button>
              <button onClick={()=>sellRune(r.uid)} className="btn px-2.5 py-1 rounded-md bg-zinc-700 text-[11px]">판매</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSkill=(s)=>{
    const legacy=Object.entries(SKILLS).filter(([id,sk])=>(sk.cls===s.cls||sk.cls===s.hcls)&&!sk.fam&&!sk.leg);
    const fams=Object.values(FAMS).filter(F=>F.cid===s.cls);
    const legs=Object.entries(SKILLS).filter(([id,sk])=>sk.leg&&sk.cls===s.cls);
    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div className="text-xs text-zinc-400">📜 {CLS[s.cls].name} 스킬 {fams.length*50+legs.length+legacy.length}종 — 계열 랭크업 1SP · 전설 각성 5SP · 랭크가 오를수록 강력해집니다</div>
          <div className="text-sm font-bold text-amber-300">보유 SP: {s.skp}</div>
        </div>
        <div className="panel p-3">
          <div className="text-xs font-bold text-cyan-300 mb-2">🎯 스킬 슬롯 ({s.loadout.length}/6) — 전투에서 사용할 스킬 (클릭하여 해제)</div>
          <div className="flex flex-wrap gap-1.5">
            {s.loadout.map(e=>{
              const rid=resolveEntry(s,e), sk=rid?SKILLS[rid]:null;
              if(!sk)return null;
              return <button key={e} onClick={()=>toggleLoadout(e)} className="btn px-2.5 py-1.5 rounded-lg bg-indigo-900/70 text-[11px] font-bold">{sk.icon} {sk.name} ✕</button>;
            })}
            {s.loadout.length===0&&<span className="text-[11px] text-zinc-600">아래 스킬 목록에서 [장착]을 눌러 슬롯을 채우세요.</span>}
          </div>
        </div>
        <div className="text-xs font-bold text-amber-300">🌟 전설 스킬 — 사용 시 전용 컷씬 발동</div>
        <div className="grid md:grid-cols-2 gap-2">
          {legs.map(([id,sk])=>{
            const owned=!!s.skills[id], locked=s.lv<sk.lv;
            return (
              <div key={id} className={"panel p-3 "+(owned?"border-amber-400/50":locked?"opacity-55":"")}>
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="text-sm font-black" style={{color:owned?"#fcd34d":"#e4e0d8"}}>{sk.icon} {sk.name}</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">{sk.desc} · MP {fmt(sk.mp)}</div>
                  </div>
                  {owned?
                    <button onClick={()=>toggleLoadout(id)} className={"btn px-2.5 py-1.5 rounded-lg text-[11px] font-bold shrink-0 "+(s.loadout.includes(id)?"bg-indigo-700":"bg-zinc-700")}>{s.loadout.includes(id)?"장착중":"장착"}</button>
                   :<button onClick={()=>learnLeg(id)} disabled={locked||s.skp<5} className="btn px-2.5 py-1.5 rounded-lg bg-amber-700 text-[11px] font-bold shrink-0">{locked?`🔒 Lv.${sk.lv}`:"각성 (5SP)"}</button>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-xs font-bold text-purple-300">📚 스킬 계열 — 10계열 × 50랭크 = 500스킬</div>
        <div className="grid md:grid-cols-2 gap-2">
          {fams.map(F=>{
            const cur=s.skills[F.id]||0;
            const curSk=cur>0?SKILLS[F.id+"_"+cur]:null;
            const nxt=cur<F.maxR?SKILLS[F.id+"_"+(cur+1)]:null;
            const locked=!!nxt&&s.lv<nxt.lv;
            return (
              <div key={F.id} className="panel p-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold">{F.icon} {F.name} {cur>0&&<span className="text-amber-300">{cur}식</span>} <span className="text-[9px] text-zinc-500">({cur}/50)</span></div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">{curSk?curSk.desc+" · MP "+curSk.mp:F.arch.d}</div>
                    {nxt&&<div className="text-[9px] text-zinc-600 mt-0.5">다음 랭크: {nxt.mult>0?Math.round(nxt.mult*100)+"% 피해":"보조 강화"} · MP {nxt.mp} · Lv.{nxt.lv} 필요</div>}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={()=>learnFam(F.id)} disabled={cur>=F.maxR||locked||s.skp<1}
                      className="btn px-2.5 py-1 rounded-lg bg-purple-800 text-[11px] font-bold">{cur>=F.maxR?"MAX":cur===0?"습득 (1SP)":"랭크업 (1SP)"}</button>
                    {cur>0&&<button onClick={()=>toggleLoadout(F.id)} className={"btn px-2.5 py-1 rounded-lg text-[10px] "+(s.loadout.includes(F.id)?"bg-indigo-700 font-bold":"bg-zinc-700")}>{s.loadout.includes(F.id)?"장착중":"장착"}</button>}
                    {cur>0&&curSk&&curSk.mult>0&&<button onClick={()=>{s.autoSkill=s.autoSkill===F.id?null:F.id;commit();}}
                      className={"btn px-2.5 py-1 rounded-lg text-[10px] "+(s.autoSkill===F.id?"bg-emerald-700 font-bold":"bg-zinc-800")}>{s.autoSkill===F.id?"자동✓":"자동"}</button>}
                  </div>
                </div>
                <div className="mt-1.5">{Bar(cur,50,"linear-gradient(90deg,#8b5cf6,#6d28d9)",5)}</div>
              </div>
            );
          })}
        </div>
        {legacy.length>0&&<div className="text-xs font-bold text-zinc-300">🗝️ 고유·히든 스킬</div>}
        {legacy.map(([id,sk])=>{
          const cur=s.skills[id]||0;
          const locked=s.lv<sk.lv;
          return (
            <div key={id} className="panel p-3 flex items-center justify-between gap-2 flex-wrap">
              <div>
                <div className="text-sm font-bold">{sk.icon} {sk.name} {cur>0&&<span className="text-amber-300">Lv.{cur}</span>} {locked&&<span className="text-[10px] text-red-400">🔒 Lv.{sk.lv} 필요</span>}</div>
                <div className="text-[11px] text-zinc-500">{sk.desc} · MP {sk.mp}{cur>0&&sk.mult>0?` · 현재 배율 ${Math.round(sk.mult*(1+0.12*(cur-1))*100)}%`:""}</div>
              </div>
              <div className="flex gap-1.5 items-center">
                {cur>0&&<button onClick={()=>toggleLoadout(id)} className={"btn px-2.5 py-1 rounded-md text-[11px] "+(s.loadout.includes(id)?"bg-indigo-700 font-bold":"bg-zinc-700")}>{s.loadout.includes(id)?"장착중":"장착"}</button>}
                {cur>0&&sk.mult>0&&<button onClick={()=>{s.autoSkill=s.autoSkill===id?null:id;commit();}}
                  className={"btn px-2.5 py-1 rounded-md text-[11px] "+(s.autoSkill===id?"bg-emerald-600 font-bold":"bg-zinc-700")}>{s.autoSkill===id?"자동✓":"자동"}</button>}
                <button onClick={()=>learnSkill(id)} disabled={locked||cur>=10||s.skp<1}
                  className="btn px-3 py-1.5 rounded-lg bg-indigo-800 text-xs font-bold">{cur===0?"습득 (1P)":cur>=10?"MAX":"강화 (1P)"}</button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderQuest=(s)=>{
    const active=QUESTS.filter(q=>s.quests[q.id]);
    const avail=QUESTS.filter(q=>!s.quests[q.id]&&(q.repeat||!s.questsDone[q.id]));
    const hidden=HIDQ.filter(h=>s.hiddenFound[h.id]&&!s.hiddenClaimed[h.id]);
    return (
      <div className="space-y-3">
        <div className="panel p-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div>
              <div className="text-sm font-bold text-cyan-300">🌍 월드 퀘스트: 대성당 재건 기금</div>
              <div className="text-[11px] text-zinc-500">모든 모험가의 기부가 모이면 경험치 +25% 버프! (가상 서버 진행도)</div>
            </div>
            {s.world.done?<span className="text-xs font-bold text-emerald-300 pop">✅ 달성! XP +25% 적용중</span>:(
              <div className="flex gap-1.5">
                {[100,500,2000].map(a=><button key={a} onClick={()=>donate(a)} className="btn px-2.5 py-1 rounded-md bg-cyan-900 text-[11px]">{a}G 기부</button>)}
              </div>
            )}
          </div>
          <div className="mt-2">{Bar(s.world.prog,s.world.goal,"linear-gradient(90deg,#06b6d4,#0891b2)",10)}</div>
          <div className="text-[10px] text-zinc-500 mt-1">{fmt(s.world.prog)} / {fmt(s.world.goal)} (내 기부 {fmt(s.world.donated)}G)</div>
        </div>
        {hidden.length>0&&(
          <div className="space-y-2">
            {hidden.map(h=>(
              <div key={h.id} className="panel p-3 border-amber-400/50 pop flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-amber-300">🎖️ 히든 퀘스트: {h.name}</div>
                  <div className="text-[11px] text-zinc-400">{h.cond}</div>
                </div>
                <button onClick={()=>claimHidden(h)} className="btn px-3 py-1.5 rounded-lg bg-amber-600 text-black text-xs font-bold">보상 수령</button>
              </div>
            ))}
          </div>
        )}
        {active.length>0&&<div className="text-xs font-bold text-zinc-300">진행 중 ({active.length}/5)</div>}
        {active.map(q=>{
          const p=qProg(q);
          return (
            <div key={q.id} className="panel p-3">
              <div className="flex justify-between items-center">
                <div className="text-sm font-bold">{q.name} <span className="text-[10px] text-zinc-500">{q.desc}</span></div>
                {p>=q.n?<button onClick={()=>claimQuest(q)} className="btn px-3 py-1.5 rounded-lg bg-emerald-700 text-xs font-bold pop">✅ 완료</button>
                  :<span className="text-xs text-zinc-400">{fmt(p)}/{q.n}</span>}
              </div>
              <div className="mt-1.5">{Bar(p,q.n,"linear-gradient(90deg,#8b5cf6,#6d28d9)",7)}</div>
            </div>
          );
        })}
        <div className="text-xs font-bold text-zinc-300">퀘스트 보드</div>
        {avail.map(q=>(
          <div key={q.id} className="panel p-3 flex justify-between items-center">
            <div>
              <div className="text-sm">{q.name} {q.repeat&&<span className="text-[9px] text-cyan-400">[반복]</span>} {s.questsDone[q.id]?<span className="text-[9px] text-zinc-500">완료 {s.questsDone[q.id]}회</span>:null}</div>
              <div className="text-[11px] text-zinc-500">{q.desc} → {q.rw.gold?fmt(q.rw.gold)+"G ":""}{q.rw.xp?fmt(q.rw.xp)+"XP ":""}{q.rw.stone?"🪨"+q.rw.stone:""}</div>
            </div>
            <button onClick={()=>acceptQuest(q)} className="btn px-3 py-1.5 rounded-lg bg-zinc-700 text-xs">수락</button>
          </div>
        ))}
      </div>
    );
  };

  const renderInv=(s,st)=>{
    const statRows=[["hp","❤️ 체력",st.hp],["mp","💧 마력",st.mp],["atk","⚔️ 공격력",st.atk],["def","🛡️ 방어력",st.def],["crit","🎯 치명타",st.crit+"%"],["critd","💥 치명피해",st.critd+"%"]];
    const H=s.hcls?HID[s.hcls]:null;
    return (
      <div className="space-y-3">
        {!s.hcls&&s.promoAvail.length>0&&(
          <div className="panel p-4 border-amber-400/60 pop">
            <div className="text-sm font-black text-amber-300 mb-2">🌟 히든 전직 가능 ({s.promoAvail.length}종) — 하나만 선택할 수 있습니다!</div>
            <div className="grid md:grid-cols-2 gap-2">
              {s.promoAvail.map(hid=>{
                const H=HID[hid]; if(!H)return null;
                const sk=SKILLS[H.skill];
                return (
                  <div key={hid} className="panel p-3 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold">{H.icon} {H.name}</div>
                      <div className="text-[10px] text-zinc-500">{H.need}</div>
                      <div className="text-[10px] text-amber-200/70 mt-0.5">공격×{H.mult.atk} · HP×{H.mult.hp} · 스킬 [{sk.icon}{sk.name}]</div>
                    </div>
                    <button onClick={()=>promote(hid)} className="btn px-3 py-2 rounded-lg bg-amber-500 text-black text-xs font-black shrink-0">전직</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="grid md:grid-cols-2 gap-3">
          <div className="panel p-4">
            <div className="text-xs font-bold text-zinc-300 mb-2">📊 스탯 {s.sp>0&&<span className="text-amber-300">(분배 가능: {s.sp})</span>}</div>
            {statRows.map(([k,label,val])=>(
              <div key={k} className="flex items-center justify-between text-sm py-0.5">
                <span className="text-zinc-400 text-xs">{label}</span>
                <span className="font-bold flex items-center gap-2">{typeof val==="number"?fmt(val):val}
                  {s.sp>0&&<button onClick={()=>allocPt(k)} className="btn w-5 h-5 rounded bg-emerald-700 text-xs leading-none">+</button>}
                </span>
              </div>
            ))}
            <div className="text-[10px] text-zinc-600 mt-1.5">+1당: HP20 · MP10 · 공2 · 방2 · 치명0.4% · 치피2%</div>
            {H&&(
              <div className="flex items-center justify-between gap-2 mt-2">
                <div className="text-[11px] text-amber-300">{H.icon} 히든 직업 [{H.name}] 보정 적용중</div>
                <button onClick={giveUpHidden} className="btn px-2 py-1 rounded-md bg-red-900/60 text-[10px] text-red-300 shrink-0">전직 포기 ({fmt(Math.round(1500*s.lv))}G)</button>
              </div>
            )}
            {!s.hcls&&<div className="text-[10px] text-zinc-600 mt-2">🔒 히든 직업 총 {Object.keys(HID).length}종 — 발견 {s.promoAvail.length}종 <span className="text-zinc-700">(특정 조건 달성 시 해금)</span></div>}
            <div className="text-[11px] text-zinc-500 mt-2 border-t border-zinc-800 pt-2">
              총 처치 {fmt(s.killTotal)} · 사망 {s.deaths} · 강화 성공 {s.enhOk} · 룬 합성 {s.fuseCount}<br/>
              언데드 처치 {s.tagKills.undead||0} · 드래곤 처치 {s.tagKills.dragon||0}
            </div>
          </div>
          <div className="panel p-4">
            <div className="text-xs font-bold text-zinc-300 mb-2">🎽 장착 장비</div>
            {SLOTS.map(slot=>(
              <div key={slot} className="flex items-center justify-between py-1 border-b border-zinc-800/60 last:border-0">
                <span className="text-[11px] text-zinc-500 w-14">{SLOT_NAME[slot]}</span>
                {s.equip[slot]?(
                  <div className="flex items-center gap-2 flex-1 justify-between">
                    <div>
                      <div className="text-sm">{itemLabel(s.equip[slot])}</div>
                      <div className="text-[10px] text-zinc-500">{itemStats(s.equip[slot])}</div>
                    </div>
                    <button onClick={()=>unequipItem(slot)} className="btn px-2 py-1 rounded bg-zinc-700 text-[10px]">해제</button>
                  </div>
                ):<span className="text-xs text-zinc-600">비어있음</span>}
              </div>
            ))}
          </div>
        </div>
        <div className="text-xs font-bold text-zinc-300">🎒 인벤토리 ({s.inv.length})</div>
        {s.inv.length===0&&<div className="panel p-4 text-center text-sm text-zinc-500">인벤토리가 비어 있습니다.</div>}
        <div className="grid md:grid-cols-2 gap-2">
          {s.inv.map(it=>(
            <div key={it.uid} className="panel p-3 flex items-center justify-between">
              <div>
                <div className="text-sm">{itemLabel(it)} <span className="text-[9px] text-zinc-600">[{SLOT_NAME[ITEMS[it.t].slot]}]</span></div>
                <div className="text-[10px] text-zinc-500">{itemStats(it)}</div>
              </div>
              <div className="flex gap-1.5">
                <button onClick={()=>equipItem(it.uid)} className="btn px-2.5 py-1 rounded-md bg-emerald-800 text-[11px]">장착</button>
                <button onClick={()=>sellItem(it.uid)} className="btn px-2.5 py-1 rounded-md bg-zinc-700 text-[11px]">판매</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderInn=(s)=>{
    const cost=50+s.lv*12;
    return (
      <div className="panel p-6 text-center space-y-3">
        <div className="text-4xl">🛏️</div>
        <div className="font-black">아늑한 모닥불 여관</div>
        <p className="text-xs text-zinc-400">여관 주인: 오늘도 고생 많았어. 푹 쉬면 HP와 MP가 전부 회복된다네.<br/>쉴 때마다 게임이 자동 저장되지.</p>
        <div className="flex gap-2 justify-center">
          <button onClick={rest} className="btn px-5 py-2.5 rounded-lg bg-emerald-800 text-sm font-bold">🛏️ 휴식하기 ({fmt(cost)}G)</button>
          <button onClick={()=>{persist();say("수동 저장 완료!");}} className="btn px-5 py-2.5 rounded-lg bg-zinc-700 text-sm">💾 수동 저장</button>
        </div>
        <div className="text-[11px] text-zinc-500">지금까지 {s.innCount}번 휴식 · 모든 행동은 자동 저장됩니다</div>
        <button onClick={logout} className="btn px-4 py-2 rounded-lg bg-red-900/60 text-xs text-red-300 mt-2">🚪 로그아웃 (저장 후 종료)</button>
      </div>
    );
  };

  /* ================= 화면: 광장 & 결투 ================= */
  const renderDuel=(s,st)=>{
    const P=plaza.current, du=P.duel;
    const learned=loadoutSkills(s);
    const canTimeout=!du.myTurn&&!du.over&&Date.now()-du.lastAct>30000;
    const meIcon=s.hcls?HID[s.hcls].icon:CLS[s.cls].icon;
    return (
      <div className="space-y-3">
        <div className="text-center text-sm font-black text-red-300 pop">🏟️ 결투장 — {du.over?(du.over==="win"?"승리!":"패배…"):du.myTurn?"내 턴!":du.opp.nick+"의 턴을 기다리는 중…"}</div>
        <div className="grid grid-cols-2 gap-3">
          <div className={"panel p-4 "+(du.myTurn&&!du.over?"border-amber-400/60":"")}>
            <div className="text-sm font-bold">{meIcon} {s.nick} <span className="text-[10px] text-zinc-500">Lv.{s.lv}</span> <span className="text-[9px] text-cyan-400">(나)</span></div>
            <div className="mt-2 text-[10px] flex justify-between"><span className="text-red-400">HP</span><span>{fmt(Math.max(0,Math.round(du.myHp)))}/{fmt(du.myMax)}</span></div>
            {Bar(du.myHp,du.myMax,"linear-gradient(90deg,#dc2626,#991b1b)",10)}
            <div className="mt-1 text-[10px] flex justify-between"><span className="text-blue-400">MP</span><span>{fmt(Math.max(0,Math.round(du.myMp)))}/{fmt(st.mp)}</span></div>
            {Bar(du.myMp,st.mp,"linear-gradient(90deg,#2563eb,#1e40af)",7)}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {du.myShield>0&&<span className="chip" style={{background:"rgba(34,211,238,.15)",color:"#67e8f9"}}>🔷 {fmt(du.myShield)}</span>}
              {du.buffs.map(b=><span key={b.k} className="chip" style={{background:"rgba(52,211,153,.15)",color:"#6ee7b7"}}>{b.k==="atk"?"⚔️":"🎯"} {b.t}턴</span>)}
            </div>
          </div>
          <div className={"panel p-4 "+(!du.myTurn&&!du.over?"border-red-400/50":"")}>
            <div className="text-sm font-bold">{du.opp.icon} {du.opp.nick} <span className="text-[10px] text-zinc-500">Lv.{du.opp.lv} {du.opp.cname}</span></div>
            <div className="mt-2 text-[10px] flex justify-between"><span className="text-purple-400">HP</span><span>{fmt(Math.max(0,Math.round(du.oppHp)))}/{fmt(du.oppMax)}</span></div>
            {Bar(du.oppHp,du.oppMax,"linear-gradient(90deg,#7c3aed,#4c1d95)",10)}
            <div className="text-[10px] text-zinc-500 mt-2">⚔️ {fmt(du.opp.atk)} · 🛡️ {fmt(du.opp.def)} · 🎯 {du.opp.crit}% · 💥 {du.opp.critd}%</div>
            <div className="text-[10px] text-zinc-500 mt-1">PvP 전적 {du.opp.w}승 {du.opp.l}패</div>
          </div>
        </div>
        {!du.over?(
          <div className="panel p-3">
            <div className="flex flex-wrap gap-2">
              <button onClick={()=>duelAct(null)} disabled={!du.myTurn} className="btn px-4 py-2 rounded-lg bg-red-700 text-white text-sm font-bold">⚔️ 공격</button>
              {learned.map(id=>{
                const sk=SKILLS[id];
                return <button key={id} onClick={()=>duelAct(id)} disabled={!du.myTurn||du.myMp<sk.mp}
                  className="btn px-3 py-2 rounded-lg bg-indigo-800 text-white text-xs font-bold">{sk.icon} {sk.name} <span className="text-indigo-300">MP{sk.mp}</span></button>;
              })}
              <button onClick={surrender} className="btn px-3 py-2 rounded-lg bg-zinc-700 text-xs">🏳️ 항복</button>
              {canTimeout&&<button onClick={claimTimeout} className="btn px-3 py-2 rounded-lg bg-amber-700 text-xs font-bold pop">⏰ 응답 없음 — 승리 선언</button>}
            </div>
            <div className="text-[10px] text-zinc-600 mt-2">PvP에서는 기절·회피·도트·디버프가 적용되지 않습니다. 30초간 응답이 없으면 승리를 선언할 수 있습니다.</div>
          </div>
        ):(
          <div className="panel p-4 text-center pop">
            <div className="text-4xl mb-1">{du.over==="win"?"🏆":"💀"}</div>
            <div className="text-sm font-bold mb-2">{du.over==="win"?`승리! +${fmt(150*Math.max(1,du.opp.lv))}G`:"패배… 다음엔 이긴다!"}</div>
            <button onClick={closeDuel} className="btn px-5 py-2 rounded-lg bg-cyan-800 text-sm font-bold">광장으로 돌아가기</button>
          </div>
        )}
        <div className="panel p-3 h-40 overflow-y-auto text-[12px] leading-relaxed">
          {du.log.map(l=>(
            <div key={l.id} className={l.c==="r"?"text-red-400":l.c==="g"?"text-emerald-300":l.c==="c"?"text-yellow-300 font-bold":"text-zinc-300"}>{l.t}</div>
          ))}
        </div>
      </div>
    );
  };

  const renderRaid=(s,st)=>{
    const P=plaza.current, rd=P.raid, B=RAID_MAP[rd.bossId];
    const isHost=rd.role==="host";
    const mems=isHost?Object.values(rd.members):rd.members;
    const myHp=isHost?(rd.members[s.nick]?rd.members[s.nick].hp:0):rd.myHp;
    const myMax=isHost?(rd.members[s.nick]?rd.members[s.nick].maxHp:1):rd.myMaxHp;
    const myDead=isHost?(rd.members[s.nick]?rd.members[s.nick].dead:false):rd.myDead;
    const myActed=isHost?(rd.members[s.nick]?rd.members[s.nick].acted:false):rd.myActed;
    const learned=loadoutSkills(s);
    const leftSec=rd.phase==="fight"&&isHost?Math.max(0,25-Math.floor((Date.now()-rd.roundStart)/1000)):null;
    return (
      <div className="space-y-3">
        <div className="text-center text-sm font-black text-red-300 pop">
          {B.icon} {B.name} — {rd.phase==="lobby"?"파티 모집 중":rd.phase==="fight"?`라운드 ${rd.round}/${B.rounds}`:rd.phase==="win"?"토벌 성공!":"토벌 실패"}
        </div>
        {rd.phase!=="lobby"&&(
          <div className="panel p-4">
            <div className="flex justify-between items-center text-sm font-bold">
              <span>{B.icon} {B.name} {rd.enraged&&<span className="chip pop" style={{background:"rgba(239,68,68,.2)",color:"#fca5a5"}}>😡 격노</span>}</span>
              <span className="text-zinc-400">{fmt(Math.max(0,rd.bossHp))}/{fmt(rd.bossMax)}</span>
            </div>
            <div className="mt-1.5">{Bar(rd.bossHp,rd.bossMax,"linear-gradient(90deg,#dc2626,#7f1d1d)",14)}</div>
            {leftSec!==null&&<div className="text-[10px] text-zinc-500 mt-1">라운드 자동 진행까지 {leftSec}초 (전원 행동 시 즉시)</div>}
          </div>
        )}
        <div className="grid md:grid-cols-2 gap-2">
          {mems.map(m=>(
            <div key={m.nick} className={"panel p-3 "+(m.dead?"opacity-50":"")}>
              <div className="flex justify-between text-xs font-bold">
                <span>{m.icon} {m.nick} {m.nick===s.nick&&<span className="text-[9px] text-cyan-400">(나)</span>} {m.dead&&"💀"}</span>
                <span className="text-zinc-500">{fmt(Math.max(0,Math.round(m.hp)))}/{fmt(m.maxHp)}</span>
              </div>
              <div className="mt-1">{Bar(m.hp,m.maxHp,"linear-gradient(90deg,#16a34a,#166534)",8)}</div>
              {rd.phase==="fight"&&<div className="text-[9px] text-zinc-500 mt-1">이번 라운드 {fmt(m.dmg||0)} · 누적 {fmt(m.total||0)}{m.acted?" ✓":""}</div>}
            </div>
          ))}
        </div>
        {rd.phase==="lobby"&&(
          <div className="panel p-4 text-center space-y-2">
            <div className="text-xs text-zinc-400">{B.d}</div>
            <div className="text-[11px] text-zinc-500">HP {fmt(B.hp)} × 인원수 · 공격 {fmt(B.atk)} · {B.rounds}라운드 제한 · 참가비 🎟️1</div>
            {isHost?(
              <div className="flex gap-2 justify-center">
                <button onClick={startRaid} className="btn px-6 py-2.5 rounded-lg bg-red-800 text-sm font-bold">⚔️ 레이드 시작 ({mems.length}인)</button>
                <button onClick={leaveRaid} className="btn px-4 py-2.5 rounded-lg bg-zinc-700 text-sm">해산</button>
              </div>
            ):(
              <div>
                <div className="text-xs text-amber-300 mb-2">호스트가 시작하길 기다리는 중…</div>
                <button onClick={leaveRaid} className="btn px-4 py-2 rounded-lg bg-zinc-700 text-xs">파티 나가기</button>
              </div>
            )}
          </div>
        )}
        {rd.phase==="fight"&&(
          <div className="panel p-3">
            <div className="flex flex-wrap gap-2">
              <button onClick={()=>raidAct(null)} disabled={myDead||myActed} className="btn px-4 py-2 rounded-lg bg-red-700 text-white text-sm font-bold">⚔️ 공격</button>
              {learned.map(id=>{
                const sk=SKILLS[id];
                return <button key={id} onClick={()=>raidAct(id)} disabled={myDead||myActed||rd.myMp<sk.mp}
                  className="btn px-3 py-2 rounded-lg bg-indigo-800 text-white text-xs font-bold">{sk.icon} {sk.name} <span className="text-indigo-300">MP{fmt(sk.mp)}</span></button>;
              })}
            </div>
            <div className="text-[10px] text-zinc-500 mt-2">내 MP {fmt(Math.max(0,Math.round(rd.myMp)))} · {myDead?"쓰러져서 행동 불가":myActed?"행동 완료 — 다른 파티원 대기 중":"이번 라운드 행동을 선택하세요"}</div>
          </div>
        )}
        {(rd.phase==="win"||rd.phase==="fail")&&(
          <div className="panel p-4 text-center pop">
            <div className="text-4xl mb-1">{rd.phase==="win"?"🏆":"💀"}</div>
            <div className="text-sm font-bold mb-2">{rd.phase==="win"?"토벌 성공! 보상이 지급되었습니다.":"토벌 실패… 재도전해 보세요."}</div>
            <button onClick={leaveRaid} className="btn px-5 py-2 rounded-lg bg-cyan-800 text-sm font-bold">광장으로 돌아가기</button>
          </div>
        )}
        <div className="panel p-3 h-40 overflow-y-auto text-[12px] leading-relaxed">
          {rd.log.map(l=>(
            <div key={l.id} className={l.c==="r"?"text-red-400":l.c==="g"?"text-emerald-300":l.c==="c"?"text-yellow-300 font-bold":l.c==="d"?"text-amber-300":"text-zinc-300"}>{l.t}</div>
          ))}
        </div>
      </div>
    );
  };

  const renderPlaza=(s,st)=>{
    const P=plaza.current;
    if(P.duel)return renderDuel(s,st);
    if(P.raid)return renderRaid(s,st);
    return (
      <div className="space-y-3">
        {!P.room?(
          <div className="panel p-6 text-center space-y-3">
            <div className="text-4xl">🌐</div>
            <div className="font-black">모험가 광장</div>
            <p className="text-xs text-zinc-400 leading-relaxed">서버 없이 브라우저끼리 직접 연결(P2P)됩니다.<br/>지금 접속해 있는 다른 모험가들과 채팅하고, 1:1 결투를 벌이세요!<br/>결투 승리 시 상대 레벨 × 150G 보상!</p>
            <button onClick={joinPlaza} disabled={P.joining} className="btn px-6 py-2.5 rounded-lg bg-cyan-800 text-sm font-bold">{P.joining?"연결 중…":"🌐 광장 입장"}</button>
            <div className="text-[11px] text-zinc-500">내 PvP 전적: <b className="text-amber-300">{s.pvpW}승 {s.pvpL}패</b></div>
          </div>
        ):(
          <React.Fragment>
            {P.pending&&(
              <div className="panel p-4 border-red-400/60 pop flex items-center justify-between flex-wrap gap-2">
                <div className="text-sm font-bold text-red-300">⚔️ {P.pending.from} (Lv.{P.pending.st.lv} {P.pending.st.cname})의 결투 신청!</div>
                <div className="flex gap-2">
                  <button onClick={acceptDuel} className="btn px-4 py-1.5 rounded-lg bg-red-700 text-xs font-bold">수락</button>
                  <button onClick={declineDuel} className="btn px-3 py-1.5 rounded-lg bg-zinc-700 text-xs">거절</button>
                </div>
              </div>
            )}
            <div className="panel p-3">
              <div className="text-xs font-bold text-red-300 mb-2">👹 파티 레이드 — 최대 4인 협동 (입장권 🎟️1 · 승리 시 신화 장비 + 전설 룬 + 대량 경험치)</div>
              {Object.values(P.parties).length>0&&(
                <div className="space-y-1.5 mb-2">
                  {Object.values(P.parties).map(ad=>{
                    const B=RAID_MAP[ad.bossId]; if(!B)return null;
                    return (
                      <div key={ad.rid} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 pop">
                        <span className="text-xs"><b>{ad.host}</b>의 파티 — {B.icon} {B.name} <span className="text-zinc-500">({ad.n}/4 · Lv.{B.lv}+)</span></span>
                        <button onClick={()=>joinRaidParty(ad)} className="btn px-3 py-1 rounded-lg bg-red-800 text-[11px] font-bold">참가</button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                {RAIDS.map(B=>{
                  const locked=s.lv<B.lv;
                  return (
                    <div key={B.id} className={"panel p-2.5 "+(locked?"opacity-55":"")}>
                      <div className="text-xs font-bold">{B.icon} {B.name}</div>
                      <div className="text-[9px] text-zinc-500 mt-0.5">HP {fmt(B.hp)}×인원 · Lv.{B.lv}+ · {B.rounds}라운드</div>
                      <button onClick={()=>openRaid(B.id)} disabled={locked}
                        className="btn w-full mt-1.5 py-1 rounded-lg bg-red-900 text-[10px] font-bold">{locked?`🔒 Lv.${B.lv}`:"파티 모집"}</button>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="panel p-3">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-xs font-bold text-cyan-300">👥 접속 중인 모험가 ({Object.keys(P.peers).length+1})</div>
                  <button onClick={leavePlaza} className="btn px-2 py-1 rounded bg-zinc-800 text-[10px] text-zinc-400">퇴장</button>
                </div>
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  <div className="flex items-center justify-between text-xs bg-white/5 rounded-lg px-2.5 py-2">
                    <span>{s.hcls?HID[s.hcls].icon:CLS[s.cls].icon} <b>{s.nick}</b> <span className="text-zinc-500">Lv.{s.lv}</span> <span className="text-[9px] text-cyan-400">(나)</span></span>
                    <span className="text-[10px] text-zinc-500">{s.pvpW}승 {s.pvpL}패</span>
                  </div>
                  {Object.values(P.peers).map(p=>(
                    <div key={p.nick} className="flex items-center justify-between text-xs bg-white/5 rounded-lg px-2.5 py-2">
                      <span>{p.icon} <b>{p.nick}</b> <span className="text-zinc-500">Lv.{p.lv} {p.cname}</span></span>
                      <span className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500">{p.w}승 {p.l}패</span>
                        <button onClick={()=>challenge(p.nick)} className="btn px-2.5 py-1 rounded bg-red-900 text-[10px] font-bold">⚔️ 결투</button>
                      </span>
                    </div>
                  ))}
                  {Object.keys(P.peers).length===0&&(
                    <div className="text-[11px] text-zinc-600 text-center py-4 leading-relaxed">아직 다른 모험가가 보이지 않습니다.<br/>다른 브라우저/기기에서 이 게임을 열고 광장에 입장하면<br/>몇 초 안에 서로 연결됩니다!</div>
                  )}
                </div>
              </div>
              <div className="panel p-3 flex flex-col">
                <div className="text-xs font-bold text-cyan-300 mb-2">💬 광장 채팅</div>
                <div className="flex-1 min-h-[180px] max-h-72 overflow-y-auto space-y-1 text-[11px] mb-2">
                  {P.chat.map(m=>(
                    <div key={m.id}><b className={m.from===s.nick?"text-amber-300":"text-cyan-300"}>{m.from}</b> <span className="text-zinc-300">{m.txt}</span></div>
                  ))}
                  {P.chat.length===0&&<div className="text-zinc-600">아직 대화가 없습니다. 먼저 인사해 보세요!</div>}
                </div>
                <div className="flex gap-1.5">
                  <input value={chatIn} onChange={e=>setChatIn(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")sendChat();}}
                    placeholder="메시지 입력… (Enter 전송)" className="flex-1 px-3 py-2 rounded-lg bg-black/50 border border-zinc-700 text-xs"/>
                  <button onClick={sendChat} className="btn px-3 py-2 rounded-lg bg-cyan-800 text-xs font-bold">전송</button>
                </div>
              </div>
            </div>
          </React.Fragment>
        )}
      </div>
    );
  };

  /* ================= 메인 게임 화면 ================= */
  const TABS=[
    ["hunt","⚔️","사냥터"],["portal","🌀","포탈"],["dungeon","🕳️","던전"],["boss","👹","보스"],
    ["plaza","🌐","광장"],["forge","⚒️","대장간"],["rune","💠","룬 공방"],["skill","📜","스킬"],["quest","📋","퀘스트"],
    ["inv","🎒","가방"],["inn","🛏️","여관"],
  ];
  const renderGame=()=>{
    const s=S.current, st=calc(s);
    const cname=s.hcls?HID[s.hcls].name:CLS[s.cls].name;
    const cicon=s.hcls?HID[s.hcls].icon:CLS[s.cls].icon;
    const need=needXp(s.lv);
    return (
      <div className="max-w-5xl mx-auto p-3 fadein">
        {/* 헤더 */}
        <div className="panel p-3 mb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{cicon}</span>
              <div>
                <div className="text-sm font-black">{s.nick} <span className="text-amber-300">Lv.{s.lv}</span> <span className="text-[10px] text-zinc-400">{cname}</span>
                  {s.world.done&&<span className="text-[9px] text-cyan-300 ml-1">🌍XP+25%</span>}</div>
                <div className="text-[10px] text-zinc-500">📍 {MAPS[s.map].icon} {MAPS[s.map].name}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="text-amber-300">💰 {fmt(s.gold)}</span>
              <span className="text-zinc-300">🪨 {s.stone}</span>
              <span className="text-purple-300">🗝️ {s.dkey}</span>
              <span className="text-red-300">🎟️ {s.rticket}</span>
              {(s.sp>0||s.skp>0)&&<span className="text-emerald-300 pop">P: 스탯{s.sp}/스킬{s.skp}</span>}
              <span className="text-[9px] text-zinc-500 font-normal" title="모든 행동 시 즉시 저장 + 20초 주기 자동 저장">💾 {lastSaveT.current?new Date(lastSaveT.current).toLocaleTimeString()+" 자동저장":"자동저장 대기"}</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2 text-[10px]">
            <div><div className="flex justify-between"><span className="text-red-400">HP</span><span>{fmt(Math.max(0,Math.round(s.hp)))}/{fmt(st.hp)}</span></div>{Bar(s.hp,st.hp,"linear-gradient(90deg,#dc2626,#991b1b)")}</div>
            <div><div className="flex justify-between"><span className="text-blue-400">MP</span><span>{fmt(Math.max(0,Math.round(s.mp)))}/{fmt(st.mp)}</span></div>{Bar(s.mp,st.mp,"linear-gradient(90deg,#2563eb,#1e40af)")}</div>
            <div><div className="flex justify-between"><span className="text-amber-400">XP</span><span>{fmt(s.xp)}/{fmt(need)}</span></div>{Bar(s.xp,need,"linear-gradient(90deg,#f59e0b,#b45309)")}</div>
          </div>
        </div>
        {/* 탭 네비 */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {TABS.map(([id,ic,label])=>(
            <button key={id} onClick={()=>{tab.current=id;bump();}}
              className={"btn px-3 py-2 rounded-lg text-xs font-bold "+(tab.current===id?"bg-red-800 text-white":"bg-zinc-800/80 text-zinc-400")}>{ic} {label}</button>
          ))}
        </div>
        {/* 콘텐츠 */}
        {tab.current==="hunt"&&renderHunt(s,st)}
        {tab.current==="portal"&&renderPortal(s)}
        {tab.current==="dungeon"&&renderDungeon(s)}
        {tab.current==="boss"&&renderBoss(s)}
        {tab.current==="plaza"&&renderPlaza(s,st)}
        {tab.current==="forge"&&renderForge(s)}
        {tab.current==="rune"&&renderRune(s)}
        {tab.current==="skill"&&renderSkill(s)}
        {tab.current==="quest"&&renderQuest(s)}
        {tab.current==="inv"&&renderInv(s,st)}
        {tab.current==="inn"&&renderInn(s)}
      </div>
    );
  };

  return (
    <div>
      {cine&&<CineFx c={cine}/>}
      {hurtK.current>0&&scr.current==="game"&&<div key={"hf"+hurtK.current} className="hurt-flash"/>}
      {toast&&<div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-black/85 border border-amber-400/40 text-amber-200 text-xs font-bold pop">{toast}</div>}
      {scr.current==="login"&&renderLogin()}
      {scr.current==="create"&&renderCreate()}
      {scr.current==="game"&&S.current&&renderGame()}
    </div>
  );
}

/* ===== 전설 스킬 컷씬 오버레이 — 레터박스·광선·충격파·입자 연출 ===== */
function CineFx({c}){
  if(c.ultra){
    return (
      <div className="ucine" style={{"--cc":c.col}} key={c.key}>
        <div className="u-dim"/>
        <div className="u-rays"/>
        <div className="u-sweep"/>
        <div className="u-flash"/>
        <div className="u-bar t"/><div className="u-bar b"/>
        {[14,32,50,68,86].map((x,i)=><div key={"pl"+i} className="u-pillar" style={{left:x+"%",animationDelay:(i*0.08)+"s"}}/>)}
        <div className="u-circle"/>
        <div className="u-circle c2"/>
        <div className="u-ring" style={{animationDelay:".62s"}}/>
        <div className="u-ring" style={{animationDelay:".92s"}}/>
        <div className="u-ring" style={{animationDelay:"2.3s"}}/>
        {Array.from({length:12}).map((_,i)=>{
          const a=(i/12)*Math.PI*2, d=40+(i%3)*8;
          return <span key={"pi"+i} className="u-p inn" style={{width:6,height:6,animationDelay:(i*0.015)+"s","--dx":Math.cos(a)*d+"vmin","--dy":Math.sin(a)*d+"vmin"}}/>;
        })}
        {Array.from({length:36}).map((_,i)=>{
          const a=(i/36)*Math.PI*2, d=30+(i%6)*8;
          return <span key={"po"+i} className="u-p out" style={{width:5+(i%4)*5,height:5+(i%4)*5,animationDelay:(0.68+i*0.014)+"s","--dx":Math.cos(a)*d+"vmin","--dy":Math.sin(a)*d+"vmin"}}/>;
        })}
        <span className="u-echo">{c.icon}</span>
        <span className="u-echo" style={{animationDelay:".5s"}}>{c.icon}</span>
        <div className="u-icon">{c.icon}</div>
        {c.cname&&<div className="u-cname">— {c.cname} 비전(祕傳) —</div>}
        <div className="u-name">{c.name.split("").map((ch,i)=><span key={i} className="u-ch" style={{animationDelay:(0.95+i*0.075)+"s"}}>{ch===" "?"\u00A0":ch}</span>)}</div>
        <div className="u-sub">HIDDEN ARTS</div>
      </div>
    );
  }
  return (
    <div className="cine" style={{"--cc":c.col}} key={c.key}>
      <div className="cine-dim"/>
      <div className="cine-rays"/>
      <div className="cine-sweep"/>
      <div className="cine-flash"/>
      <div className="cine-bar t"/><div className="cine-bar b"/>
      <div className="cine-ring"/>
      <div className="cine-ring" style={{animationDelay:".55s"}}/>
      {Array.from({length:22}).map((_,i)=>{
        const a=(i/22)*Math.PI*2, d=26+(i%5)*7;
        return <span key={i} className="cine-p" style={{width:5+(i%4)*4,height:5+(i%4)*4,animationDelay:(0.26+i*0.02)+"s","--dx":Math.cos(a)*d+"vmin","--dy":Math.sin(a)*d+"vmin"}}/>;
      })}
      <div className="cine-icon">{c.icon}</div>
      <div className="cine-name">{c.name}</div>
      <div className="cine-sub">LEGENDARY ARTS</div>
    </div>
  );
}

/* 렌더 오류 방어: 오류 발생 시 검은 화면 대신 복구 안내 표시 (데이터는 localStorage에 안전) */
class ErrorBoundary extends React.Component{
  constructor(p){ super(p); this.state={err:null}; }
  static getDerivedStateFromError(e){ return {err:e}; }
  componentDidCatch(e,info){ console.error("render error",e,info); }
  render(){
    if(this.state.err){
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="panel p-8 max-w-sm text-center">
            <div className="text-4xl mb-2">⚠️</div>
            <div className="font-black text-red-300 mb-2">일시적인 오류가 발생했습니다</div>
            <p className="text-xs text-zinc-400 mb-4">저장 데이터는 안전합니다. 아래 버튼으로 게임을 다시 불러오세요.</p>
            <button onClick={()=>location.reload()} className="btn px-6 py-2.5 rounded-lg bg-red-700 text-white text-sm font-bold">🔄 다시 불러오기</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
ReactDOM.createRoot(document.getElementById("root")).render(<ErrorBoundary><Game/></ErrorBoundary>);
</script>
</body>
</html>
'''


def abyss_rpg_page():
    st.title("🩸 나락의 심연 — 하드코어 RPG")
    st.caption("초장기 파밍 RPG! 기본 직업 13종 · 직업당 스킬 500+전설 5(컷씬)+히든 비전 컷씬·공격 모션 · 3개 월드 86맵(Lv150/500 게이트) · 장비 5부위 · 히든 직업 56종 · 던전 30·보스 35 · 🌐 온라인 광장(채팅·PvP·최대 4인 파티 레이드) · 자동저장")
    components.html(ABYSS_RPG_HTML, height=920, scrolling=True)


# ==========================================
# 8. 메인 네비게이션 진입 게이트웨이
# ==========================================
st.set_page_config(
    page_title="종합 게임 허브 스트림릿",
    page_icon="🌟",
    layout="wide"
)

home = st.Page(home_page, title="홈 화면", icon="🌟")
game = st.Page(game_page, title="업다운 게임", icon="🎮")
board = st.Page(board_page, title="뱀사다리 말판 게임", icon="🎲")
quoridor = st.Page(quoridor_page, title="쿼리도 두뇌 게임", icon="🧱")
rpg = st.Page(rpg_page, title="9속성 타워 디펜스", icon="🛡️")
multiplayer_rpg = st.Page(multiplayer_rpg_page, title="1대1 멀티 RPG 배틀", icon="⚔️")
dragon = st.Page(dragon_nursery_page, title="드래곤 보육원 & 배틀", icon="🐉")
rider = st.Page(dragon_rider_page, title="드래곤 서바이버", icon="🐲")
monggle = st.Page(monggle_page, title="몽글이 키우기", icon="🌸")
zombie = st.Page(zombie_fps_page, title="좀비 디펜스 FPS", icon="🧟")
ant = st.Page(ant_war_page, title="개미굴 대전", icon="🐜")
gladiator = st.Page(gladiator_page, title="검투사 아레나", icon="⚔️")
abyss = st.Page(abyss_rpg_page, title="나락의 심연 RPG", icon="🩸")
wordle = st.Page(wordle_page, title="워들 퍼즐 게임", icon="🔠")
adventure = st.Page(adventure_page, title="마법학교 신입생의 하루", icon="🗺️")
typing_game = st.Page(typing_game_page, title="스피드 타자 워리어", icon="⌨️")

pg = st.navigation([home, game, board, quoridor, rpg, multiplayer_rpg, dragon, rider, monggle, zombie, ant, gladiator, abyss, wordle, adventure, typing_game])
pg.run()

